declare module 'semver' {
  function gt(v1: string, v2: string): boolean;
  function lt(v1: string, v2: string): boolean;
  function gte(v1: string, v2: string): boolean;
  function lte(v1: string, v2: string): boolean;
  function eq(v1: string, v2: string): boolean;
  function valid(v: string | null): string | null;
  function clean(v: string): string | null;
  function satisfies(version: string, range: string): boolean;
  function coerce(v: string | null): { version: string } | null;

  const semver: {
    gt: typeof gt;
    lt: typeof lt;
    gte: typeof gte;
    lte: typeof lte;
    eq: typeof eq;
    valid: typeof valid;
    clean: typeof clean;
    satisfies: typeof satisfies;
    coerce: typeof coerce;
  };

  export default semver;
}
