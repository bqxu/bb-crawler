let {Crawler} = require('../crawler');
let util = require('util');

const main = async () => {

    let crawler = new Crawler({
        logger: {
            service: 'test',
            level: 'debug'
        },
        oss: {
            region: '',
            accessKeyId: '',
            accessKeySecret: '',
            bucket:'',
        },
        async request(ctx, url) {
            return {data: null};
        },
        async store(ctx, url) {
            let res = await  ctx.oss.list('/');
            ctx.logger.info(util.format(`res %j` ,res.objects.map(el=>el.name)));
        },
        async release(ctx) {
            ctx.logger.info('success');
        }
    });

    await crawler.task('test');


};

main().then(() => {

});