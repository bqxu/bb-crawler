let {Crawler} = require('../crawler');

const main = async () => {

    let crawler = new Crawler({
        url: `http://www.xbiquge.la/`,
        cache:{type:'file'},
        async store(ctx) {
            console.log(ctx.data);
        }
    });

    await crawler.start();


};

main().then(() => {

});