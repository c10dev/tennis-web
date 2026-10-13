// Waiting without hanging: a promise that may never settle (a WebGL context lost mid-compile) gets a time limit.

/** Resolves when `p` settles, either way, or after `ms`, whichever comes first. */
export function within(p: Promise<unknown>, ms: number): Promise<void> {
  return new Promise((done) => {
    const timer = setTimeout(done, ms);
    const finish = () => {
      clearTimeout(timer);
      done();
    };
    p.then(finish, finish);
  });
}
