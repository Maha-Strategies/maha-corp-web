/**
 * `pg` is loaded dynamically and typed locally on purpose.
 *
 * It is not a project dependency - it exists only where someone has installed
 * it to run the local lifecycle reconstruction. A static import would make
 * typecheck and install depend on a package the application never uses.
 */
interface QueryResult { rows: Record<string, unknown>[] }
interface PgPool {
  query(text: string, values?: unknown[]): Promise<QueryResult>
  end(): Promise<void>
}

export async function loadPool(connectionString: string): Promise<PgPool | null> {
  try {
    // A non-literal specifier: TypeScript does not try to resolve a package
    // the project does not depend on, and Node resolves it at run time if the
    // person running this has installed it.
    const specifier = 'pg'
    const pg = await import(specifier) as { default?: { Pool: new (c: { connectionString: string }) => PgPool }; Pool?: new (c: { connectionString: string }) => PgPool }
    const Pool = pg.default?.Pool ?? pg.Pool
    return Pool ? new Pool({ connectionString }) : null
  } catch {
    return null
  }
}

/**
 * A minimal supabase-js surface backed by real PostgreSQL.
 *
 * The point is to drive the *actual* store functions and the actual release
 * executor against the actual six-migration schema, rather than a fixture that
 * might omit the very prerequisite the route supplies. Only the shapes those
 * functions use are implemented; anything else throws rather than silently
 * returning empty, so an unimplemented path cannot look like a passing test.
 */
export function makeClient(pool: PgPool) {

  const wrap = async <T>(run: () => Promise<T>): Promise<{ data: T | null; error: { code?: string; message: string } | null }> => {
    try {
      return { data: await run(), error: null }
    } catch (error) {
      const pgError = error as { code?: string; message: string }
      return { data: null, error: { code: pgError.code, message: pgError.message } }
    }
  }

  const builder = (table: string) => {
    const state = { columns: '*', order: '', limit: '', filters: [] as string[], values: [] as unknown[] }
    const api = {
      select(columns: string) { state.columns = columns.split(',').map((c) => `"${c.trim()}"`).join(', '); return api },
      order(column: string, options?: { ascending?: boolean }) {
        state.order = ` order by "${column}" ${options?.ascending === false ? 'desc' : 'asc'}`; return api
      },
      limit(count: number) { state.limit = ` limit ${count}`; return api },
      eq(column: string, value: unknown) {
        state.values.push(value); state.filters.push(`"${column}" = $${state.values.length}`); return api
      },
      then(resolve: (value: { data: unknown[] | null; error: unknown }) => void, reject?: (reason: unknown) => void) {
        const where = state.filters.length > 0 ? ` where ${state.filters.join(' and ')}` : ''
        wrap(async () => {
          const result = await pool.query(`select ${state.columns} from public."${table}"${where}${state.order}${state.limit}`, state.values)
          return result.rows
        }).then(resolve, reject)
      },
    }
    return api
  }

  return {
    from: builder,
    async rpc(name: string, args: Record<string, unknown>) {
      const names = Object.keys(args)
      const placeholders = names.map((key, index) => `${key} => $${index + 1}`)
      return wrap(async () => {
        const result = await pool.query(
          `select public."${name}"(${placeholders.join(', ')}) as value`,
          names.map((key) => {
            const value = args[key]
            return typeof value === 'string' ? value : JSON.stringify(value)
          }),
        )
        return result.rows[0]?.value
      })
    },
    async raw(sql: string, values: unknown[] = []) { return pool.query(sql, values) },
    async end() { await pool.end() },
  }
}
