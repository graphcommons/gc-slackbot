'use strict';

import request from 'request';
import { asyncify } from './async';
import jobQueue from './job-queue';

export default function gcScheduler(opts) {

  opts = opts || {};

  function sendSignals(signals) {
    let body = JSON.stringify({
      signals: Array.isArray(signals) ? signals : [signals]
    });
    const options = {
      url: `${process.env.GC_ROOT}/api/v1/graphs/${opts.graphId}/add`,
      method: 'PUT',
      headers: {
        'Authentication': process.env.GC_TOKEN,
        'Content-Type': 'application/json',
        'Content-Length': body.length
      },
      body: body
    };

    return asyncify((done, fail) => {
      request(options, (err, response, body) => {
        if (err) {
          return fail(err);
        }

        done();
      });
    });
  };

  function createGraph() {

    const body = JSON.stringify({
      name: 'My Slack graph',
      description: 'generated',
      status: 0,
      signals: []
    });

    const options = {
      url: `${process.env.GC_ROOT}/api/v1/graphs`,
      method: 'POST',
      headers: {
        'Authentication': process.env.GC_TOKEN,
        'Content-Type': 'application/json',
        'Content-Length': body.length
      },
      body: body
    };

    return asyncify((done, fail) => {
      request(options, (err, response, body) => {
        if (err) {
          return fail(err);
        }

        const respJSON = JSON.parse(body);
        done(respJSON.graph.id);
      });
    });
  }

  let scheduler = jobQueue({jobFn: sendSignals});

  function addSignals(signals) {
    scheduler.addJob(signals);
  };

  if (!opts.graphId) {
    createGraph().then((id) => {
      opts.graphId = id;
      scheduler.start();
    });
  }
  else {
    scheduler.start();
  }

  return {
    addSignals: addSignals
  };
}
