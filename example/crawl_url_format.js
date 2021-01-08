let {Crawler} = require('../crawler');

const main = async () => {

    let crawler = new Crawler({
        url: `http://www.xbiquge.la/`,
        async format(ctx){
            const html  = ctx.res.data;
            let $=  ctx.jquery.load(html);
            let a = $('a[href]');
            let href = [];
            a.each((i,n)=>{
                // console.log(n)
                href.push($(n).attr('href'));
            })
            return href;
        } ,
        async store(ctx) {
            console.log(ctx.data);
        }
    });

    await crawler.start();

};

main().then(() => {

});