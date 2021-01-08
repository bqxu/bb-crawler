let {Crawler} = require('../crawler');
let util = require('util');

const main = async () => {

    let crawler = new Crawler({
        logger: {
            service: 'test',
            level: 'debug'
        },
        mysql: {
            host: '',
            port: '',
            user: '',
            password: '',
            database: '',
        },
        async request(ctx, url) {
            return {data: null};
        },
        async store(ctx, url) {
            let res = await  ctx.mysql.query('select * from iapp.app');
            ctx.logger.info(util.format(`res %j` ,res));
        },
        async release(ctx) {
            ctx.logger.info('success');
        }
    });

    await crawler.task('test');


};

main().then(() => {

});