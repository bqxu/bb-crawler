import * as OSS from 'ali-oss'
import * as Rds from 'ali-rds'
import * as Redis from 'ioredis'
import * as Cos from 'cos-nodejs-sdk-v5'
import * as cheerio from 'cheerio'
import * as async from 'async'
import * as Axios from 'axios'
import * as schedule from 'node-schedule'
import * as crypto from 'crypto'
import {Buffer} from 'buffer'
import {URL} from 'url'
import * as fs from 'fs'
import * as path from 'path'
import * as mkdirp from 'mkdirp'
import * as winston from 'winston'
import * as _ from 'lodash'
import * as util from 'util'
import * as Urllib from 'urllib';

class Config {
    urls?: string[];
    url?: string;
    cron: string | any;
    mysql?: any;
    redis?: any;
    oss?: any;
    cos?: any;
    env?: any;
    axios?: any;
    logger?: any;
    cache?: {
        prefix: string
    } | any;
    beforeRequest?: Function;
    request?: Function;
    format?: Function;
    store?: Function;
    release?: Function;
    urllib?: any;;
    network?: any;;
}

interface Cache {

    hasCache(key): Promise<any>;

    get(key): Promise<any>;

    set(key, value): Promise<any>;
}

export class CacheOSS implements Cache {

    ctx: Context;
    prefix: string;
    encoding: BufferEncoding;
    oss: OSS;

    constructor(ctx) {
        this.ctx = ctx;
        const {prefix, oss, encoding} = ctx.config.cache;
        this.prefix = prefix || '';
        this.encoding = encoding || 'utf8';
        if (oss) {
            this.oss = new OSS(oss);
        } else {
            this.oss = ctx.oss;
        }
    }

    async hasCache(key) {
        try {
            await this.oss.head(`${this.prefix}${key}`)
            return true;
        } catch (e) {
            return false;
        }
    }

    async get(key) {
        const result = await this.oss.get(`${this.prefix}${key}`);
        return result.content.toString(this.encoding);
    }

    async set(key, value) {
        await this.oss.put(`${this.prefix}${key}`, Buffer.from(value, this.encoding));
    }
}

export class CacheCos implements Cache {

    cos: Cos;
    ctx: Context;
    prefix: string;
    Bucket: string;
    Region: string;

    constructor(ctx) {
        this.ctx = ctx;
        const {prefix, cos, Bucket, Region} = ctx.config.cache;
        this.prefix = prefix || ''
        if (cos) {
            this.cos = new Cos(cos);
            this.Bucket = Bucket || cos.Bucket;
            this.Region = Region || cos.Region;
        } else {
            this.cos = ctx.cos;
            this.Bucket = Bucket || ctx.config.cos.Bucket;
            this.Region = Region || ctx.config.cos.Bucket;
        }
    }

    async hasCache(key) {
        return new Promise((resolve, reject) => {
            this.cos.headObject({
                Bucket: this.Bucket, // Bucket 格式：test-1250000000
                Region: this.Region, // Bucket 格式：test-1250000000
                Key: `${this.prefix}${key}`
            }, function (err, data) {
                if (err) {
                    resolve(false)
                    return
                }
                resolve(true)
            });
        })
    }

    async get(key) {
        return new Promise((resolve, reject) => {
            this.cos.getObject({
                Bucket: this.Bucket, // Bucket 格式：test-1250000000
                Region: this.Region, // Bucket 格式：test-1250000000
                Key: `${this.prefix}${key}`
            }, function (err, data) {
                if (err) {
                    reject(err);
                    return
                }
                resolve(data.Body)
            });
        })
    }

    async set(key, value) {
        return new Promise((resolve, reject) => {
            this.cos.putObject({
                Bucket: this.Bucket, // Bucket 格式：test-1250000000
                Region: this.Region, // Bucket 格式：test-1250000000
                Key: `${this.prefix}${key}`,
                Body: value
            }, function (err, data) {
                if (err) {
                    reject(err);
                    return
                }
                resolve(data)
            });
        })
    }
}

export class CacheFile implements Cache {

    prefix: string;
    encoding: BufferEncoding;

    constructor(ctx) {
        const {prefix, encoding} = ctx.config.cache;
        this.prefix = prefix || path.join(process.cwd(), 'files');
        this.encoding = encoding || 'utf8';
    }

    async hasCache(key) {
        return fs.existsSync(path.join(this.prefix, key))
    }

    async get(key) {
        return fs.readFileSync(path.join(this.prefix, key), {encoding: this.encoding})
    }

    async set(key, value) {
        mkdirp.sync(path.parse(path.join(this.prefix, key)).dir)
        return fs.writeFileSync(path.join(this.prefix, key), value, {encoding: this.encoding})
    }
}


export class Utils {

    md5(content) {
        return crypto.createHash('md5').update(content).digest("hex")
    }

    base64md5(content) {
        return crypto.createHash('md5').update(Buffer.from(content, 'utf8').toString('base64')).digest("hex")
    }

    hexmd5(content) {
        return crypto.createHash('md5').update(Buffer.from(content, 'utf8').toString('hex')).digest("hex")
    }

    url_path(url) {
        if (!url) {
            return url
        }
        return url.replace(/:/g, '_')
            .replace(/\//g, '_')
            .replace(/\?/g, '_')
            .replace(/&/g, '__')
    }

    url_dir(url) {
        let urlObj = new URL(url);
        return `${urlObj.hostname}/${this.url_path(`${urlObj.pathname}${urlObj.search}`)}`;
    }
}

interface Network {
 
    get(url, params?:any,config?:any);

    getJSON(url, params?:any,config?:any);

    postJSON(url, data?:any,config?:any);

    postJSON_rText(url, data?:any,config?:any)

    
}


class NetworkAxios implements Network {

    axios: Axios.AxiosInstance;

    constructor(config = {}) {
        this.axios = Axios.default.create(config)
    }

    get(url, params?:any,config?:any) {
        return this.axios.get(url, Object.assign({},{params, responseType: 'text'},config))
    }

    getJSON(url, params?:any,config?:any)  {
        return this.axios.get(url, Object.assign({},{params},config))
    }

    postJSON(url, data?:any,config?:any) {
        return this.axios.get(url, Object.assign({},{data, method: 'post'},config))
    }

    postJSON_rText(url, data?:any,config?:any) {
        return this.axios.get(url, Object.assign({},{data, method: 'post', responseType: 'text'},config))
    }
}

class NetworkUrlLib implements Network {

    
    config: any;

    constructor(config = {}) {
       const config_:any =  this.config = Object.assign({},config);    
        this.make_proxy(this.config)
    }

    make_proxy(config?:any){
        if(config && config.proxy){
            if(config.proxy.host){
                let proxy_str = `${config.proxy.protocol}://${config.proxy.host}:${config.proxy.port}`;
                if(config.proxy.auth){
                    proxy_str = `${config.proxy.protocol}://${config.proxy.auth.username}:${config.proxy.auth.password}@${config.proxy.host}:${config.proxy.port}`;
                }
                config.proxy= proxy_str;    
            }                
        }
    }

    get(url, params?:any,config?:any) {
        this.make_proxy(config)
        return Urllib.request(url,Object.assign({ method: 'GET',data:params, dataType: 'text'},this.config,config))
    }

    getJSON(url, params?:any,config?:any){
        this.make_proxy(config)
        return Urllib.request(url,Object.assign({ method: 'GET',data:params, dataType: 'json'},this.config,config))
    }

    postJSON(url, data?:any,config?:any){
        this.make_proxy(config)
        return Urllib.request(url, Object.assign({method: 'POST',data, dataType: 'json'},this.config,config))
    }

    postJSON_rText(url, data?:any,config?:any){
        this.make_proxy(config)
        return Urllib.request(url,Object.assign({ method: 'POST',data, dataType: 'text'},this.config,config))
    }
}



class Context {
    config: Config;

    mysql: Rds;
    redis: Redis;
    oss: OSS;
    cos: Cos;
    jquery: any;
    axios: any;
    urllib: any;
    network: any;
    res: any;
    data: any;
    utils: Utils;
    cache: Cache;
    logger: winston.Logger;

    done:boolean;

    constructor(config) {
        this.config = config;
        // this.init();
    }

    async init() {
        const {mysql, redis, oss, cos, axios, env, cache,urllib,network} = this.config;

        this.jquery = cheerio;
        this.utils = new Utils();

        if (mysql instanceof Rds) {
            this.mysql = mysql;
        } else if (mysql) {
            this.mysql = new Rds(mysql)
        }

        if (redis instanceof Redis) {
            this.redis = redis;
        } else if (redis) {
            this.redis = new Redis(redis)
        }

        if (oss instanceof OSS) {
            this.oss = oss;
        } else if (oss) {
            this.oss = new OSS(oss)
        }

        if (cos instanceof Cos) {
            this.cos = cos;
        } else if (cos) {
            this.cos = new Cos(cos)
        }

        if(axios){
            this.axios =  Axios.default.create(axios);
        }else {
            this.axios = Axios.default.create(axios);
        }

        this.urllib = Urllib;

        if (network && network.type ==='axios') {
            this.network = new NetworkAxios(axios);        
        } else  {
            this.network = new NetworkUrlLib(urllib);
        }

        if (cache) {
            const {type} = cache;
            switch (type) {
                case 'file':
                    this.cache = new CacheFile(this);
                    break;
                case 'oss':
                    this.cache = new CacheOSS(this);
                    break;
                case 'cos':
                    this.cache = new CacheCos(this);
                    break;
            }
        }

        if (env) {
            await env(this);
        }

    }

    async cache_url(url) {
        return this.utils.url_dir(url);
    }

    async beforeRequest(url) {
        const {beforeRequest} = this.config;
        if (beforeRequest) {
            await beforeRequest(this, url);
        }
    }

    async request(url) {
        const profiler = this.logger.startTimer();
        const {request} = this.config;
        let res = null;
        if (request) {
             try{
                res = await request(this, url)
             }catch(e){
                this.logger.error(util.format(`url:%s error: %s`, url, e.message), {tag: "request"})
                throw e;
            } 
        } else {
            const profiler = this.logger.startTimer();
            try{
                res = this.network.get(url)
            }catch(e){
                this.logger.error(util.format(`url:%s error: %s`, url, e.message), {tag: "axios"})
                throw e;
            } finally {
                profiler.done({service: this.config.logger.service, tag: url, level: 'debug', message: 'request timer'});
            }
            
        }
        
        return res;
    }

    async requestCache(ctx , url){
        const {requestCache} = ctx.config
        if (requestCache) {
            return await requestCache(ctx,url);
        }
        let cacheUrl = await ctx.cache_url(url);;
        return {
            data:await ctx.cache.get(cacheUrl)
        }
    }

    async format(url) {
        const profiler = this.logger.startTimer();
        const {format} = this.config;
        let res = null;
        if (format) {
            res = await format(this,url)
        }else{
            res = this.res.data;
        }
        profiler.done({service: this.config.logger.service, tag: url, level: 'debug', message: 'format timer'});
        return res;
    }

    async store(url) {
        const profiler = this.logger.startTimer();
        const {store} = this.config;
        if (store) {
            await store(this,url)
        }
        profiler.done({service: this.config.logger.service, tag: url, level: 'debug', message: 'store timer'});
    }

    async release() {
        const {release} = this.config;
        if (this.mysql) {
            this.mysql.end(() => {            
                this.logger.debug(`mysql end`, {tag: "release"})
            })
        }

        if (this.redis) {
            this.redis.quit(() => {
                this.logger.debug(`redis quit`, {tag: "release"})
            })
        }

        if (release) {
            await release(this)
            this.logger.debug(`release()`, {tag: "release"})
        }
    }
}

const defaultConfig = {
    limit: 1,
    logger: {
        console: true,
        level: 'info',
        service: "Crawler",
        files: [],
    }
}

export class Crawler {

    ctx: Context;

    config: Config | any;

    job: any;
    isRun: boolean;
    logger: winston.Logger;

    // loggerFmt(){
    //     return
    // }

    constructor(config: Config | string | any) {
        if (typeof(config) === 'string') {
            config = {
                url: config
            }
        }
        // if (!config.urls && config.url) {
        //     config.urls = [config.url]
        // }
        this.config = _.merge({}, defaultConfig, config);
        // console.log(this.config);
        this.logger = winston.createLogger({
            level: this.config.logger.level,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            defaultMeta: {service: this.config.logger.service},
            transports: this.config.logger.files.map((file) => {
                return new winston.transports.File(file)
            }),
        });
        if (this.config.logger.console) {
            this.logger.add(new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.colorize(),
                    winston.format.timestamp(),
                    winston.format.json(),
                    winston.format.printf(
                        info => {
                            if (typeof info.durationMs !== "undefined") {
                                return `${info.timestamp} ${info.level} [${info.service}${info.tag ? `:${info.tag}` : ''}]: ${info.message}:${info.durationMs}`
                            }
                            return `${info.timestamp} ${info.level} [${info.service}${info.tag ? `:${info.tag}` : ''}]: ${info.message}`
                        })
                )
            }));
        }
    }

    async urls() {
        const {url, urls} = this.config;
        if(url){
            return [url];
        }
        if(urls ){
            return await urls()
        }
        return [];
    }

    async newContext() {
        const ctx = new Context(_.assign({}, this.config));
        ctx.logger = this.logger;
        try{
            await ctx.init();
        } catch(e){
            ctx.logger.error(e.message);
            await ctx.release()
            return null;
        }    
        
        return ctx;
    }

    async task(url) {
        this.logger.info(util.format(`url:%s`, url), {tag: 'task'})
        let ctx = await this.newContext();
        if(!ctx){
            throw new Error(`can't newContext`)
        }
        try{
            await ctx.beforeRequest(url);
            if(ctx.done){
                this.logger.info(util.format(`url:%s `, url), {tag: "done"})
                await ctx.release();
                return  
            }
            if (ctx.cache) {
                let cacheUrl = await ctx.cache_url(url);
                this.logger.debug(util.format(`cacheUrl:%s `, cacheUrl), {tag: url});
                if (await ctx.cache.hasCache(cacheUrl)) {
                    this.logger.debug(util.format(`hasCache`), {tag: url});
                    ctx.res = await ctx.requestCache(ctx, url);
                } else {
    
                    ctx.res = await ctx.request(url);
                    // console.log(ctx.res);
                    await ctx.cache.set(cacheUrl, ctx.res.data)
                }
            } else {
                ctx.res = await ctx.request(url);
            }
            ctx.data = await ctx.format(url);
            await ctx.store(url);
            await ctx.release();
        } catch(e) {
            this.logger.error(util.format(`url:%s error: %s`, url, e.message), {tag: "task"})
            await ctx.release();
        }
        
    }

    async tasks() {
        // config =
        const {limit, allowError} = this.config;
        let urls = await this.urls();
        this.logger.info(util.format('urls.length %d', urls.length), {tag: "tasks"})
        return new Promise((resolve, reject) => {
            async.eachLimit(urls, limit, async (url) => {
                try {
                    await this.task(url);
                } catch (e) {
                    this.logger.error(util.format(`url:%s error %s`, url, e.message), {tag: 'tasks'})
                    if (!allowError) {
                        throw e;
                    }
                }
            }, function (err) {
                if (err) {
                    this.logger.error(util.format(`error:%s`, err.message), {tag: "tasks"});
                    reject(err);
                    return;
                }
                resolve(err);
            })
        })
    }

    async start() {
        const {limit, cron, urls} = this.config;
        if (cron) {
            this.logger.info('cron', cron)
            this.job = schedule.scheduleJob(cron, () => {
                if (this.isRun) {
                    return
                }
                this.isRun = true;
                this.tasks().then(() => {
                    this.isRun = false;
                })
            })
        } else {
            this.isRun = true;
            this.tasks().then(() => {
                this.isRun = false;
            })
        }
    }

    async stop() {
        if (this.job) {
            this.job.cancel();
        }
    }

}