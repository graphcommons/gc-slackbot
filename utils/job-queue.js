'use strict';

export default function jobQueue(opts) {
  let started = false;
  let jobs = [];
  let jobFn = opts.jobFn;

  let run = () => {
    if (jobs.length > 0) {
      jobFn(jobs[0]).then(() => {
        jobs.shift();
        run();
      })
    }
    else {
    }
  };

  return {
    addJob: (job) => {
      jobs.push(job);
      if (started) {
        run();
      }
    },
    start: () => {
      started = true;
      run();
    }
  }
}
