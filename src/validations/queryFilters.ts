import { allowedLevel , bucketSize , groupByValues } from "./constants.js";
import { parseNonEmptyString, parseCursor,parseDate,parseEnum,parseLimit } from "./primitives.js";

export type LogFilters = {
    service? :  string ;
    level?   :  string ;
    since?   :  Date ;
    until?   :  Date ;
    q?       :  string ;
    attrs    :  [string,string][] ;
}


export type ParseResult<T> = {ok :true, value:T} | {ok: false, error:string[]};

export function parseCommon(query : any) : {filters:LogFilters ; errors: string[]} {

    const errors : string[] = [];
    const filters: LogFilters = {attrs:[]};

    if(query.service !== undefined ){ 
        const v = parseNonEmptyString(query.service);
        (!v ? errors.push("invalid service") : filters.service = v );
        
    }
    if(query.level !== undefined) {
        const v = parseEnum(query.level , allowedLevel);
        (!v ? errors.push("invalid level") : filters.level = v );
        
    }
    if(query.since !== undefined) {
        const v = parseDate(query.since);
        (!v ? errors.push("invalid since") : filters.since = v );
    }

    if(query.until !== undefined) {
        const v = parseDate(query.until);
        (!v ? errors.push("invalid unitl") : filters.until = v );
    }

    if(query.q !== undefined) {
        const v = parseNonEmptyString(query.q);
        (!v ? errors.push("invalid q") : filters.q = v );
    }  

    for (const [k,v] of Object.entries(query)) {
        if(!k.startsWith("attr.")) continue;
        const key = k.slice(5);
        const val = (v === undefined || v === null ? "" : String(v));
        if(!key || val ===  "") {errors.push("invalid attr"); continue; }
        filters.attrs.push([key,val]);
    }

    return {filters,errors};
}

export function parseLogFilters(query:any)  : ParseResult<any> {

    const {filters,errors} = parseCommon(query);
    let limit = 100;
    let cursor:bigint|undefined;

    if(query.limit !== undefined  ){
        const v = parseLimit(query.limit);
        (v === null ? errors.push("invalid limit") : limit = v );
    }

    if(query.cursor !== undefined ) {
        const v = parseCursor(query.cursor);
        (v === null ? errors.push("invalid cursor") : cursor = v);
    }

    return errors.length ? {ok : false , error:errors} : {ok : true, value:{...filters,limit,cursor}};
}

export function parseAggregateFilters(query:any) : ParseResult<any>{
    const {filters,errors} = parseCommon(query);

    if(filters.since === undefined  ) errors.push("since is required");
    if(filters.until === undefined ) errors.push("until is required");

    const bucket = query.bucket !== undefined ? parseEnum(query.bucket,bucketSize) : null;
    if(!bucket) errors.push("buckets requires one of these 1m|1h|1d|5m");
    let groupBy: string | undefined;

    if(query.group_by !== undefined){
        const v = parseEnum(query.group_by , groupByValues);
        (!v ? errors.push("invalid group by") : groupBy = v);
    }


    return errors.length ? {ok : false , error:errors} : {ok : true, value:{...filters,bucket:bucket! ,groupBy}};

}