'use strict';

import winston from 'winston';

export const createLogger = function() {
  var transports = [];
  transports.push(new winston.transports.Console());

  if (process.env.LOG_TO_FILE) {
    transports.push(new winston.transports.File({ filename: 'logs.log' }))
  }

  let logger = new (winston.Logger)({
    transports
  });

  const logFor = level => message => {
    logger[level].call(logger, message);
  }

  const logWrapper = function() {
    return {
      info: logFor('info'),
      error: logFor('error')
    };
  };

  return {
    info: logFor('info'),
    error: logFor('error')
  };
}
