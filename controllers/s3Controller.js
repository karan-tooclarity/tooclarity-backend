const { generateUploadUrl } = require("../utils/s3Util");

exports.getUploadUrl = async (req, res) => {
  try {
    const { filename, filetype } = req.body;

    if (!filename || !filetype) {
      return res.status(400).json({ error: "filename and filetype are required" });
    }

    // Generate presigned URL and public URL
    const { uploadUrl, publicUrl } = await generateUploadUrl(filename, filetype);

    // Return both URLs
    return res.json({
      uploadUrl,  // For frontend PUT request
      publicUrl,  // Publicly accessible file URL
    });
  } catch (error) {
    console.error("Error generating upload URL:", error);
    const message = /Region is missing/i.test(String(error?.message || ''))
      ? "S3 region is missing. Set AWS_REGION on the server."
      : "Failed to generate upload URL";
    res.status(500).json({ error: message });
  }
};

// Controller for generating public URL for an existing object
exports.getPublicUrl = async (req, res) => {
  try {
    const { key } = req.body;

    if (!key) {
      return res.status(400).json({ error: "S3 object key is required" });
    }

    // Call your util function
    const publicUrl = await generatePublicUrl(key);

    return res.json({ publicUrl });
  } catch (error) {
    console.error("Error generating public URL:", error);
    res.status(500).json({ error: "Failed to generate public URL" });
  }
};
