let {Crawler} = require('../crawler');
let path = require('path');

const main = async () => {

    let crawler = new Crawler({
        axios:{
            timeout:3000,
            headers:{
                'user-agent':`Mozilla/5.0 (Macintosh; Intel Mac OS X 11_1_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36`,
                'Accept-Language':`Accept-Language`,
                'Accept':`text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9`
            }
        },
        url: `https://www.biquge.info/10_10582/23080790.html`,
        cache: {type: 'file', prefix: path.join(__dirname, '../files/')},
        async format(ctx) {
            const html = ctx.res.data;
            let $ = ctx.jquery.load(html);
            let a = $('a[href]');
            let href = [];
            a.each((i, n) => {
                // console.log(n)
                href.push($(n).attr('href'));
            })
            return href;
        },
        async store(ctx) {
            console.log(ctx.data);
        }
    });

    await crawler.start();


};

main().then(() => {

});