let {Crawler} = require('../crawler');
let util = require('util');

const main = async () => {

    let crawler = new Crawler({
        logger: {
            service: 'test',
            level: 'debug'
        },
        cos: {
            SecretId: '',
            SecretKey: '',
        },
        async request(ctx, url) {
            return {data: null};
        },
        async store(ctx, url) {
            let res = await new Promise((resolve, reject)=>{
                ctx.cos.getBucket({
                    Bucket:'', /* 必须 */
                    Region: '', /* 必须 */
                    key: '',
                },function(err, data) {
                        ctx.logger.error(err);
                        resolve(err || data.Contents);
                    });
            })
            ctx.logger.info(util.format(`res %j` ,res.map(el=>el.Key)));
        },
        async release(ctx) {
            ctx.logger.info('success');
        }
    });

    await crawler.task('test');


};

main().then(() => {
    console.log('end');
}).catch((error)=>{
    console.log(error);
})