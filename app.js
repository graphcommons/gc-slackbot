'use strict';

import Botkit from 'botkit';
import memStorage from './utils/mem-storage';
import { asyncCollect, asyncWaterfall, asyncify } from './utils/async';
import graphCommonsConnector from './utils/gc-connector';

/*
  We have a controller and a bot.
  Controller manages the environment, acts as a bridge to Slack and creates bots.
  We only need one bot in this app and it is created below.
*/
const controller = Botkit.slackbot({
  debug: process.env.DEBUG === 'true',
  storage: memStorage
});

const bot = controller.spawn({
  token: process.env.SLACK_TOKEN
});

const GC_CONNECTOR = graphCommonsConnector({
  storage: controller.storage,
  bot: bot
});

/*
  Establish connection to Slack.
  Upon connection a big chunk of data containing user and channel
  information is received. We pass the data to the GC_CONNECTOR
  to save the initial data in the storage.
*/
bot.startRTM((err, bot, payload) => {
  if (err) {
    throw new Error(err);
  }

  GC_CONNECTOR.initialize(payload.users, payload.channels);
});

/*
  listens to ambient messaging in the channels
  ambient messages are messages that do not mention the bot
*/
controller.on('ambient', (bot, message) => {
  GC_CONNECTOR.onMessageReceived(message);
});

controller.on('user_channel_join', (bot, payload) => {
  GC_CONNECTOR.onUserJoinedChannel(payload);
});

controller.on('channel_leave', (bot, payload) => {
  GC_CONNECTOR.onUserLeftChannel(payload);
});

controller.on('channel_created', (bot, payload) => {
  let channel = payload.channel;
  //TODO:
});

controller.on('channel_joined', (bot, payload) => {
  let channel = payload.channel;
  // TODO
});

controller.on('message_deleted', (bot, payload) => {
  // TODO
});

controller.on('channel_deleted', (bot, payload) => {
  // TODO
});

controller.on('message_changed', (bot, payload) => {
  // TODO
});

controller.on('team_join', (bot, payload) => {
  // TODO
});

controller.on('channel_archive', (bot, payload) => {
  // TODO
});

controller.on('channel_unarchive', (bot, payload) => {
  // TODO
});

controller.on('channel_rename', (bot, payload) => {
  // TODO
});

controller.hears(['graphurl', 'graph url'],'direct_message,direct_mention,mention', function(bot, payload) {
  const graphUrl = GC_CONNECTOR.getGraphUrl();
  bot.reply(payload, 'Here is your team graph on Graph Commons ' + graphUrl);
});

/*
  This part is only added for easier deployment to Heroku.
  Sets up the default webserver to listen on the PORT
*/
controller.setupWebserver(process.env.PORT || 5000, (err, webserver) => {
  controller
    .createHomepageEndpoint(controller.webserver);
});
