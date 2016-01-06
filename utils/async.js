'use strict';

import Promise from 'promise';

/*
  A function is applied to an array of items in
  parallel.
*/
export function asyncCollect(items, fn) {
  return Promise.all(items.map((item) => {
    return new Promise((resolve, reject) => {
      fn.call(null, item, resolve, reject);
    });
  }));
}

/*
  Runs a bunch of asynchronous routines in sequence and collects results
  from each routine.
  Routines are supplied as steps containing the array of items and the function
  to be applied.
  Each function should return an object that would collectively be concatenated
  to the final array.However, if you have no other option that returning an
  array, set flatten to true to flatten the array of arrays into arrays.
  format: { fn: function() {}, items: [], flatten: false }

  instead of flatten: flag, there could be a transformation function
*/
export function asyncWaterfall(steps) {
  let results = [];
  let prom = Promise.resolve([]);

  // classic Promise series routine is set up here
  steps.forEach((step) => {

    prom = prom.then((res) => {
      results = results.concat(res);

      // create a Promise for each item to be processed
      // These will be processed in parallel below.
      let promises = step.items.map((item) => {
        return new Promise((resolve, reject) => {
          step.fn.call(null, item, resolve, reject);
        });
      });

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


  // Finally promise the result
  return new Promise((resolve, reject) => {
    prom.then((res) => {
      results = results.concat(res).filter(r => r);
      resolve(results);
    });
  });
}

/*
  Wraps a function inside a promise.
*/
export function asyncify(fn) {
  return new Promise((resolve, reject) => {
    fn.call(null, resolve, reject);
  });
}
