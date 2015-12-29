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
  let prom = Promise.resolve([]);

  steps.forEach((step) => {
    let promises = step.items.map((item) => {
      return new Promise((resolve, reject) => {
        step.fn.call(null, item, resolve, reject);
      });
    });
    prom = prom.then((res) => {

      results = results.concat(res);

      if (step.flatten) {
        return new Promise((resolve, reject) => {
          Promise.all(promises).then((res) => {
            resolve([].concat.apply([], res));
          });
        });
      }
      else {
        return Promise.all(promises);
      }
    });
  });


  return new Promise((resolve, reject) => {
    prom.then((res) => {
      results = results.concat(res);
      resolve(results);
    });
  });
}

export function asyncify(fn) {
  return new Promise((resolve, reject) => {
    fn.call(null, resolve, reject);
  });
}
