import {query} from "N";

export function fetchOneValue(sqlString: string): string | null {
    /**
     * When it is known that the result will be a single value. The value is returned as a string
     */
    let results: query.Result[];
    try {
        results = query.runSuiteQL({ query: sqlString }).results;
    } catch (_) {
        return null;
    }

    if (results.length === 0) {
        return null;
    }
    if (!results[0].values || results[0].values.length < 0) {
        return null;
    }

    return String(results[0].values[0]);
}

export function SQLUnlimited(sql: string, log?: (s: string) => void): query.QueryResultMap[] {
    /*
    Uses wrapper to overcome the 5000 limit of SuiteQL. Since most scripts governance limit is 1000,
    this function is limited by 100 requests. Thus, max rows number is 5000 * 100 = 500 000.
    If you need more rows, consider using MapReduce instead
    IMPORTANT! All columns in the sql query must be named and unique.
    For example, not "select id from customer", but "select id as c1_id from customer"
    */
    const result: query.QueryResultMap[] = [];
    for (let i = 0; i < 100; i++) {
        // query.runSuiteQL limit is 5000 rows
        const wrappedSQL = `SELECT * FROM (SELECT rownum as row_number, * FROM (${sql})) WHERE ( row_number BETWEEN ${result.length} AND ${result.length + 5000} )`
        log?.(wrappedSQL);
        const partialResult = query.runSuiteQL({query: wrappedSQL}).asMappedResults()

        // Removing the 'row_number' column from each row in the result
        const partialResultWithoutRowNumber = partialResult.map(row => {
            const {_, ...rest} = row;
            return rest;
        });
        result.push(...partialResultWithoutRowNumber)
        log?.(`Fetched ${partialResult.length} rows`);
        if (partialResult.length < 5000) {
            break;
        }
    }
    return result;
}