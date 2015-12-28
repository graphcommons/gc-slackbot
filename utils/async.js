'use strict';

import Promise from 'promise';

export function asyncCollect(items, fn) {
  return Promise.all(items.map((item) => {
    return new Promise((resolve, reject) => {
      fn.call(null, item, resolve, reject);
    });
  }));
}

export function asyncWaterfall(steps) {
  let results = [];
  let prom = Promise.resolve(true);

  steps.forEach((step) => {
    let promises = step.items.map((item) => {
      return new Promise((resolve, reject) => {
        step.fn.call(null, item, resolve, reject);
      });
    });
    prom = prom.then((res) => {
      results = results.concat(res);
      return Promise.all(promises);
    });
  });

  return prom;
}

export function asyncify(fn) {
  return new Promise((resolve, reject) => {
    fn.call(null, resolve, reject);
  });
}
