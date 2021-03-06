"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const OSS = require("ali-oss");
const Rds = require("ali-rds");
const Redis = require("ioredis");
const Cos = require("cos-nodejs-sdk-v5");
const cheerio = require("cheerio");
const async = require("async");
const Axios = require("axios");
const schedule = require("node-schedule");
const crypto = require("crypto");
const buffer_1 = require("buffer");
const url_1 = require("url");
const fs = require("fs");
const path = require("path");
const mkdirp = require("mkdirp");
const winston = require("winston");
const _ = require("lodash");
const util = require("util");
const Urllib = require("urllib");
class Config {
    ;
    ;
}
class CacheOSS {
    constructor(ctx) {
        this.ctx = ctx;
        const { prefix, oss, encoding } = ctx.config.cache;
        this.prefix = prefix || '';
        this.encoding = encoding || 'utf8';
        if (oss) {
            this.oss = new OSS(oss);
        }
        else {
            this.oss = ctx.oss;
        }
    }
    async hasCache(key) {
        try {
            await this.oss.head(`${this.prefix}${key}`);
            return true;
        }
        catch (e) {
            return false;
        }
    }
    async get(key) {
        const result = await this.oss.get(`${this.prefix}${key}`);
        return result.content.toString(this.encoding);
    }
    async set(key, value) {
        if (!value) {
            return;
        }
        await this.oss.put(`${this.prefix}${key}`, buffer_1.Buffer.from(value, this.encoding));
    }
}
exports.CacheOSS = CacheOSS;
class CacheCos {
    constructor(ctx) {
        this.ctx = ctx;
        const { prefix, cos, Bucket, Region } = ctx.config.cache;
        this.prefix = prefix || '';
        if (cos) {
            this.cos = new Cos(cos);
            this.Bucket = Bucket || cos.Bucket;
            this.Region = Region || cos.Region;
        }
        else {
            this.cos = ctx.cos;
            this.Bucket = Bucket || ctx.config.cos.Bucket;
            this.Region = Region || ctx.config.cos.Bucket;
        }
    }
    async hasCache(key) {
        return new Promise((resolve, reject) => {
            this.cos.headObject({
                Bucket: this.Bucket,
                Region: this.Region,
                Key: `${this.prefix}${key}`
            }, function (err, data) {
                if (err) {
                    resolve(false);
                    return;
                }
                resolve(true);
            });
        });
    }
    async get(key) {
        return new Promise((resolve, reject) => {
            this.cos.getObject({
                Bucket: this.Bucket,
                Region: this.Region,
                Key: `${this.prefix}${key}`
            }, function (err, data) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(data.Body);
            });
        });
    }
    async set(key, value) {
        if (!value) {
            return;
        }
        return new Promise((resolve, reject) => {
            this.cos.putObject({
                Bucket: this.Bucket,
                Region: this.Region,
                Key: `${this.prefix}${key}`,
                Body: value
            }, function (err, data) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(data);
            });
        });
    }
}
exports.CacheCos = CacheCos;
class CacheFile {
    constructor(ctx) {
        const { prefix, encoding } = ctx.config.cache;
        this.prefix = prefix || path.join(process.cwd(), 'files');
        this.encoding = encoding || 'utf8';
    }
    async hasCache(key) {
        return fs.existsSync(path.join(this.prefix, key));
    }
    async get(key) {
        return fs.readFileSync(path.join(this.prefix, key), { encoding: this.encoding });
    }
    async set(key, value) {
        mkdirp.sync(path.parse(path.join(this.prefix, key)).dir);
        return fs.writeFileSync(path.join(this.prefix, key), value, { encoding: this.encoding });
    }
}
exports.CacheFile = CacheFile;
class Utils {
    md5(content) {
        return crypto.createHash('md5').update(content).digest("hex");
    }
    base64md5(content) {
        return crypto.createHash('md5').update(buffer_1.Buffer.from(content, 'utf8').toString('base64')).digest("hex");
    }
    hexmd5(content) {
        return crypto.createHash('md5').update(buffer_1.Buffer.from(content, 'utf8').toString('hex')).digest("hex");
    }
    url_path(url) {
        if (!url) {
            return url;
        }
        return url.replace(/:/g, '_')
            .replace(/\//g, '_')
            .replace(/\?/g, '_')
            .replace(/&/g, '__');
    }
    url_dir(url) {
        let urlObj = new url_1.URL(url);
        return `${urlObj.hostname}/${this.url_path(`${urlObj.pathname}${urlObj.search}`)}`;
    }
}
exports.Utils = Utils;
class NetworkAxios {
    constructor(config = {}) {
        this.axios = Axios.default.create(config);
    }
    get(url, params, config) {
        return this.axios.get(url, Object.assign({}, { params, responseType: 'text' }, config));
    }
    getJSON(url, params, config) {
        return this.axios.get(url, Object.assign({}, { params }, config));
    }
    postJSON(url, data, config) {
        return this.axios.get(url, Object.assign({}, { data, method: 'post' }, config));
    }
    postJSON_rText(url, data, config) {
        return this.axios.get(url, Object.assign({}, { data, method: 'post', responseType: 'text' }, config));
    }
}
class NetworkUrlLib {
    constructor(config = {}) {
        const config_ = this.config = Object.assign({}, config);
        this.make_proxy(this.config);
        if (this.config.maxConnect) {
            this.maxConnect = 5;
        }
        else {
            this.maxConnect = 1;
        }
    }
    make_proxy(config) {
        if (config && config.proxy) {
            if (config.proxy.host) {
                let proxy_str = `${config.proxy.protocol}://${config.proxy.host}:${config.proxy.port}`;
                if (config.proxy.auth) {
                    proxy_str = `${config.proxy.protocol}://${config.proxy.auth.username}:${config.proxy.auth.password}@${config.proxy.host}:${config.proxy.port}`;
                }
                config.proxy = proxy_str;
            }
        }
    }
    get(url, params, config) {
        this.make_proxy(config);
        return Urllib.request(url, Object.assign({ method: 'GET', data: params, dataType: 'text' }, this.config, config));
    }
    getJSON(url, params, config) {
        this.make_proxy(config);
        return Urllib.request(url, Object.assign({ method: 'GET', data: params, dataType: 'json' }, this.config, config));
    }
    postJSON(url, data, config) {
        this.make_proxy(config);
        return Urllib.request(url, Object.assign({ method: 'POST', data, dataType: 'json' }, this.config, config));
    }
    postJSON_rText(url, data, config) {
        this.make_proxy(config);
        return Urllib.request(url, Object.assign({ method: 'POST', data, dataType: 'text' }, this.config, config));
    }
}
class Task {
    constructor(handler, args) {
        this.handler = handler;
        this.args = args;
    }
    exec() {
    }
}
class ThreadPool {
    constructor(config) {
        Object.assign(this, config);
        if (!this.maxConnect) {
            this.maxConnect = 1;
        }
        if (!this.timeout) {
            this.timeout = 100000;
        }
    }
    run(handler, args) {
        let task = new Task(handler, args);
    }
}
class Context {
    constructor(config) {
        this.config = config;
        // this.init();
    }
    async init() {
        const { mysql, redis, oss, cos, axios, env, cache, urllib, network } = this.config;
        this.jquery = cheerio;
        this.utils = new Utils();
        if (mysql instanceof Rds) {
            this.mysql = mysql;
        }
        else if (mysql) {
            this.mysql = new Rds(mysql);
        }
        if (redis instanceof Redis) {
            this.redis = redis;
        }
        else if (redis) {
            this.redis = new Redis(redis);
        }
        if (oss instanceof OSS) {
            this.oss = oss;
        }
        else if (oss) {
            this.oss = new OSS(oss);
        }
        if (cos instanceof Cos) {
            this.cos = cos;
        }
        else if (cos) {
            this.cos = new Cos(cos);
        }
        if (axios) {
            this.axios = Axios.default.create(axios);
        }
        else {
            this.axios = Axios.default.create(axios);
        }
        this.urllib = Urllib;
        if (network && network.type === 'axios') {
            this.network = new NetworkAxios(axios);
        }
        else {
            this.network = new NetworkUrlLib(urllib);
        }
        if (cache) {
            const { type } = cache;
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
        const { cache_url } = this.config;
        if (cache_url) {
            return await cache_url(this, url);
        }
        return this.utils.url_dir(url);
    }
    async beforeRequest(url) {
        const { beforeRequest } = this.config;
        if (beforeRequest) {
            await beforeRequest(this, url);
        }
    }
    async request_url(url) {
        const { request_url } = this.config;
        if (request_url) {
            return await request_url(this, url);
        }
        return url;
    }
    async request(url) {
        const profiler = this.logger.startTimer();
        const { request } = this.config;
        let res = null;
        let request_url = await this.request_url(url);
        if (request) {
            try {
                res = await request(this, url);
            }
            catch (e) {
                this.logger.error(util.format(`url:%s error: %s`, request_url, e.message), { tag: "request" });
                throw e;
            }
        }
        else {
            const profiler = this.logger.startTimer();
            try {
                res = await this.network.get(request_url);
            }
            catch (e) {
                this.logger.error(util.format(`url:%s error: %s`, request_url, e.message), { tag: "axios" });
                throw e;
            }
            finally {
                profiler.done({ service: this.config.logger.service, tag: request_url, level: 'debug', message: 'request timer' });
            }
        }
        return res;
    }
    async requestCache(ctx, url) {
        const { requestCache } = ctx.config;
        if (requestCache) {
            return await requestCache(ctx, url);
        }
        let cacheUrl = await ctx.cache_url(url);
        ;
        return {
            data: await ctx.cache.get(cacheUrl)
        };
    }
    async format(url) {
        const profiler = this.logger.startTimer();
        const { format } = this.config;
        let res = null;
        let request_url = await this.request_url(url);
        if (format) {
            res = await format(this, url);
        }
        else {
            res = this.res.data;
        }
        profiler.done({ service: this.config.logger.service, tag: request_url, level: 'debug', message: 'format timer' });
        return res;
    }
    async store(url) {
        const profiler = this.logger.startTimer();
        const { store } = this.config;
        let request_url = await this.request_url(url);
        if (store) {
            await store(this, url);
        }
        profiler.done({ service: this.config.logger.service, tag: request_url, level: 'debug', message: 'store timer' });
    }
    async release() {
        const { release } = this.config;
        if (this.mysql) {
            this.mysql.end(() => {
                this.logger.debug(`mysql end`, { tag: "release" });
            });
        }
        if (this.redis) {
            this.redis.quit(() => {
                this.logger.debug(`redis quit`, { tag: "release" });
            });
        }
        if (release) {
            await release(this);
            this.logger.debug(`release()`, { tag: "release" });
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
};
class Crawler {
    // loggerFmt(){
    //     return
    // }
    constructor(config) {
        if (typeof (config) === 'string') {
            config = {
                url: config
            };
        }
        // if (!config.urls && config.url) {
        //     config.urls = [config.url]
        // }
        this.config = _.merge({}, defaultConfig, config);
        // console.log(this.config);
        this.logger = winston.createLogger({
            level: this.config.logger.level,
            format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
            defaultMeta: { service: this.config.logger.service },
            transports: this.config.logger.files.map((file) => {
                return new winston.transports.File(file);
            }),
        });
        if (this.config.logger.console) {
            this.logger.add(new winston.transports.Console({
                format: winston.format.combine(winston.format.colorize(), winston.format.timestamp(), winston.format.json(), winston.format.printf(info => {
                    if (typeof info.durationMs !== "undefined") {
                        return `${info.timestamp} ${info.level} [${info.service}${info.tag ? `:${info.tag}` : ''}]: ${info.message}:${info.durationMs}`;
                    }
                    return `${info.timestamp} ${info.level} [${info.service}${info.tag ? `:${info.tag}` : ''}]: ${info.message}`;
                }))
            }));
        }
    }
    async urls() {
        const { url, urls } = this.config;
        if (url) {
            return [url];
        }
        if (urls) {
            return await urls();
        }
        return [];
    }
    async newContext() {
        const ctx = new Context(_.assign({}, this.config));
        ctx.logger = this.logger;
        try {
            await ctx.init();
        }
        catch (e) {
            ctx.logger.error(e.message);
            await ctx.release();
            return null;
        }
        return ctx;
    }
    async task(url) {
        this.logger.info(util.format(`url:%j`, url), { tag: 'task' });
        let ctx = await this.newContext();
        if (!ctx) {
            throw new Error(`can't newContext`);
        }
        try {
            await ctx.beforeRequest(url);
            let request_url = await ctx.request_url(url);
            if (ctx.done) {
                this.logger.info(util.format(`url:%s `, request_url), { tag: "done" });
                await ctx.release();
                return;
            }
            if (ctx.cache) {
                let cacheUrl = await ctx.cache_url(url);
                this.logger.debug(util.format(`cacheUrl:%s `, cacheUrl), { tag: request_url });
                if (await ctx.cache.hasCache(cacheUrl)) {
                    this.logger.debug(util.format(`hasCache`), { tag: request_url });
                    ctx.res = await ctx.requestCache(ctx, url);
                }
                else {
                    ctx.res = await ctx.request(url);
                    // console.log(ctx.res);
                    await ctx.cache.set(cacheUrl, ctx.res.data);
                }
            }
            else {
                ctx.res = await ctx.request(url);
            }
            ctx.data = await ctx.format(url);
            await ctx.store(url);
            await ctx.release();
        }
        catch (e) {
            this.logger.error(util.format(`url:%o error: %s`, url, e.message), { tag: "task" });
            await ctx.release();
        }
    }
    async tasks() {
        // config =
        const { limit, allowError } = this.config;
        let urls = await this.urls();
        this.logger.info(util.format('urls.length %d', urls.length), { tag: "tasks" });
        return new Promise((resolve, reject) => {
            async.eachLimit(urls, limit, async (url) => {
                try {
                    await this.task(url);
                }
                catch (e) {
                    this.logger.error(util.format(`url:%s error %s`, url, e.message), { tag: 'tasks' });
                    if (!allowError) {
                        throw e;
                    }
                }
            }, function (err) {
                if (err) {
                    this.logger.error(util.format(`error:%s`, err.message), { tag: "tasks" });
                    reject(err);
                    return;
                }
                resolve(err);
            });
        });
    }
    async start() {
        const { limit, cron, urls } = this.config;
        if (cron) {
            this.logger.info('cron', cron);
            this.job = schedule.scheduleJob(cron, () => {
                if (this.isRun) {
                    return;
                }
                this.isRun = true;
                this.tasks().then(() => {
                    this.isRun = false;
                });
            });
        }
        else {
            this.isRun = true;
            this.tasks().then(() => {
                this.isRun = false;
            });
        }
    }
    async stop() {
        if (this.job) {
            this.job.cancel();
        }
    }
}
exports.Crawler = Crawler;
