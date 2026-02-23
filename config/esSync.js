const { Client } = require('@elastic/elasticsearch');
const Course = require('../models/Course');
const ELASTICSEARCH_NODE = process.env.ELASTICSEARCH_NODE;
console.log(ELASTICSEARCH_NODE);

const esClient = new Client({
  node: ELASTICSEARCH_NODE,
  auth: {
    apiKey: process.env.ELASTICSEARCH_API_KEY,
  },
  ssl: {
    rejectUnauthorized: false,
  },
});

const INDEX_NAME = 'courses_index';

async function initializeElasticsearch() {
  try {
    const { acknowledged } = await esClient.indices.exists({ index: INDEX_NAME });
    if (!acknowledged) {
      await esClient.indices.create({
        index: INDEX_NAME,
        mappings: {
          properties: {
            id: { type: 'keyword' },
            courseName: { type: 'text' },
            selectBranch: { type: 'text' },
          },
        },
      });
      console.log(`🆕 Created index: ${INDEX_NAME}`);
    }

    const { count } = await esClient.count({ index: INDEX_NAME });
    if (count > 0) {
      console.log(`✅ Elasticsearch already contains ${count} documents. Skipping sync.`);
      return;
    }

    const courses = await Course.find({ status: 'Active' }).select('courseName selectBranch');
    if (!courses.length) {
      console.log('ℹ️ No active courses found to sync.');
      return;
    }

    const body = courses.flatMap(doc => [
      { index: { _index: INDEX_NAME, _id: doc._id.toString() } },
      {
        id: doc._id.toString(),
        courseName: doc.courseName || null,
        selectBranch: doc.selectBranch || null,
      },
    ]);

    const { errors } = await esClient.bulk({ refresh: true, body });

    if (errors) {
      console.error('❌ Some errors occurred during initial ES sync.');
    } else {
      console.log(`🚀 Indexed ${courses.length} active courses into Elasticsearch`);
    }

  } catch (err) {
    console.error('❌ Error initializing Elasticsearch:', err.message);
  }
}

module.exports = { initializeElasticsearch };
