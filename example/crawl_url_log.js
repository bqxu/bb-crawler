let {Crawler} = require('../crawler');

const main = async () => {

    let crawler = new Crawler({
        logger: {
            service: 'test',
            level:'debug',
            files: [
                {filename: 'error.log', level: 'error'},
                {filename: 'out.log'}
            ]
        },
        url: `http://www.xbiquge.la/`,
        async release(ctx) {
            ctx.logger.info('success');
        }
    });

    await crawler.start();


};

main().then(() => {

});