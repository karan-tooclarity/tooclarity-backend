// backend/config/elasticsearch.js
require('dotenv').config({ path: './.env.development' });
const { Client } = require('@elastic/elasticsearch');
const logger = require('./logger');

// It's highly recommended to use environment variables for configuration
const ELASTICSEARCH_NODE = process.env.ELASTICSEARCH_NODE || 'http://localhost:9200';
const esIndex = 'institutions';

const esClient = new Client({
  node: ELASTICSEARCH_NODE,
  auth: {
    apiKey: process.env.ELASTICSEARCH_API_KEY
  },
  ssl: {
    rejectUnauthorized: false,
  },
});

const checkConnection = async () => {
  try {
    await esClient.ping();
    logger.info("✅ Elasticsearch connection successful!");
  } catch (error) {
    logger.error("❌ Elasticsearch connection failed:", error);
  }
};

checkConnection();

module.exports = { esClient, esIndex };
