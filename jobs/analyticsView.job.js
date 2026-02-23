const cron = require("node-cron");
const mongoose = require("mongoose");
const redisClient = require("../config/redisConfig");
const AnalyticsDaily = require("../models/AnalyticsDaily");
const UserStats = require("../models/userStats");
const Enquiries = require("../models/Enquiries");

function getISTMidnight() {
  const ist = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  ist.setHours(0, 0, 0, 0);
  return ist;
}

cron.schedule("*/1 * * * *", async () => {
  console.log(
    "⏳ [Worker] Syncing analytics (views + leads + callbacks + demos)..."
  );

  try {
    // Load all possible metric keys
    const [viewKeys, leadKeys, callbackKeys, demoKeys] = await Promise.all([
      redisClient.keys("viewCourse:*"),
      redisClient.keys("leadImpression:*"),
      redisClient.keys("callbackRequest:*"),
      redisClient.keys("bookDemoRequest:*"),
    ]);

    const allKeys = [...viewKeys, ...leadKeys, ...callbackKeys, ...demoKeys];
    console.log(`📦 Found ${allKeys.length} analytics keys.`);

    if (!allKeys.length) return;

    const day = getISTMidnight();

    // Run SCARD for each redis key
    const pipeline = redisClient.multi();
    allKeys.forEach((key) => pipeline.scard(key));
    const counts = await pipeline.exec();

    const bulkOps = [];

    allKeys.forEach((key, index) => {
      const [primary, courseId, institutionId] = key.split(":");
      const count = counts[index][1];

      if (!count || !courseId || !institutionId) return;

      const courseObj = new mongoose.Types.ObjectId(courseId);
      const instObj = new mongoose.Types.ObjectId(institutionId);

      // --- Map Redis Key prefix ➜ Metric field in Mongo ---
      let metricField = null;

      if (primary === "viewCourse") metricField = "views";
      else if (primary === "leadImpression") metricField = "leads";
      else if (primary === "callbackRequest") metricField = "callbackRequest";
      else if (primary === "bookDemoRequest") metricField = "bookDemoRequest";

      if (!metricField) return;

      bulkOps.push({
        updateOne: {
          filter: {
            scope: "COURSE",
            courseId: courseObj,
            institutionId: instObj,
            day,
          },
          update: {
            $inc: { [metricField]: count },
            $setOnInsert: {
              scope: "COURSE",
              courseId: courseObj,
              institutionId: instObj,
              day,
            },
          },
          upsert: true,
        },
      });
    });

    if (bulkOps.length) {
      await AnalyticsDaily.bulkWrite(bulkOps, { ordered: false });
    }

    const pendingStats = await redisClient.hgetall("pendingUserStats");

    if (pendingStats && Object.keys(pendingStats).length > 0) {
      const statsBulkOps = [];

      for (const userId in pendingStats) {
        const statField = pendingStats[userId];

        statsBulkOps.push({
          updateOne: {
            filter: { userId },
            update: { $inc: { [statField]: 1 } },
            upsert: true,
          },
        });
      }

      if (statsBulkOps.length) {
        await UserStats.bulkWrite(statsBulkOps, { ordered: false });
      }

      await redisClient.del("pendingUserStats");
      console.log("🟩 Processed UserStats queue");
    }

    // -----------------------------------------------
    // PROCESS ENQUIRIES QUEUE
    // -----------------------------------------------
    let enquiry;
    const enquiryBulk = [];

    while ((enquiry = await redisClient.lpop("pendingEnquiries"))) {
      const data = JSON.parse(enquiry);

      enquiryBulk.push({
        institution: data.institutionId,
        programInterest: "",
        enquiryType: data.enquiryType,
        student: data.userId,
        status: data.enquiryType,
        statusHistory: [
          {
            status: data.enquiryType,
            changedBy: data.userId,
            changedAt: new Date(data.timestamp),
            notes: "",
          },
        ],
      });
    }

    if (enquiryBulk.length) {
      await Enquiries.insertMany(enquiryBulk);
      console.log("🟩 Processed Enquiry queue:", enquiryBulk.length);
    }

    // Delete processed keys
    await redisClient.del(allKeys);
    console.log("🧹 Deleted processed Redis analytics keys.");
  } catch (err) {
    console.error("❌ Analytics Worker Error:", err);
  }
});
