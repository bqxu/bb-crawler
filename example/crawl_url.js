let {Crawler} = require('../crawler');

const main = async () => {

    let crawler = new Crawler({
        url: `http://www.xbiquge.la/`,
        async store(ctx) {
            console.log(ctx.data);
        }
    });

    await crawler.start();


};

main().then(() => {

});