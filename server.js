const express = require('express');
const app = express ();
var bodyParser = require('body-parser');
var cors = require('cors');
const knex = require('knex');

const db = knex({
    client: 'pg',
    connection: {
        connectionString: process.env.DATABASE_URL,
        ssl: true,
    }
})

app.use(cors());
app.use(bodyParser.json());
app.get('/', (req, res) => {
    res.send('this is working')
})

{/*Post on corn sales if nothing is there for selected day*/}
app.post('/cornpost', (req, res) => {
    const {sales_date} = req.body;
    cornSales = [];
    blankItemIDs = [];
    {/*Checking if there are any sales for that day*/}
    db.select('*').from('cornsales').where({sales_date})
        .then(sale => {
            cornSales.push(sale)
        })
            .then(() => {
                if (cornSales[0].length > 0) {
                    res.json('Corn sales data found')
                } else {
                    {/*Create blank corn sales*/}
                    db('cornsales')
                    .insert({
                        total: 0,
                        sales_date: sales_date
                    })
                    .catch(err => res.status(400).json('error'))
                }
            })
    })

{/*Post on Select Date if selected date has no data*/}
app.post('/Selectday', (req, res) => {
    const {sales_date} = req.body;
    daySales = [];
    blankItemIDs = [];
    {/*Checking if there are any sales for that day*/}
    db.select('*').from('sales').where({sales_date})
        .then(sale => {
            daySales.push(sale)
        })
        .then(() => {
            let numberOfItems = ''
            db('items').count('*').then((count)=>{
                numberOfItems = parseInt(count[0].count)
            })
            .then(() => {
                if (daySales[0].length-1 > 0 && daySales[0].length-1 === numberOfItems) {
                    res.json('Sales data found')
                } else {
                    {/*Create array of all item ids*/}
                    db.select('*').from('items')
                    .then(items => {
                        items.forEach(item => {
                            blankItemIDs.push(item.id);
                        })
                        if (blankItemIDs.length === 0) {
                            res.json('No items in database');
                        } else {
                            let existingItems = [];
                            daySales[0].forEach(sale => {
                                existingItems.push(sale.item_id)
                            })
                            blankItemIDs.forEach(item_id => {
                                /*!== A SALES ID WITH THE SAME ITEM ID IN THE DATABASE*/
                                if (existingItems.indexOf(item_id) < 0) { 
                                    db('sales')
                                    .insert({
                                        item_id: item_id,
                                        number: 0,
                                        total: 0,
                                        sales_date: sales_date
                                    })
                                    .then(()=> {
                                    })
                                }
                            })
                            db.select('*').from('sales').where({sales_date})
                                .then(() => {
                                    res.json('Blank item created');                     
                                }) /*DOESN'T CREATE ANYTHING */
                        }
                    })
                }
            })
        })
    })

{/*Get on Select Date to populate Sales Tables */}
app.get('/Salestable/:sales_date', (req, res) => {
    const {sales_date} = req.params;
    if (!sales_date) {
        res.status(400).json('No Sales Data')
    } else {
        db.select('items.itemname', 'sales.number', 'sales.total', 'sales.id')
            .from('sales')
            .join('items', 'sales.item_id', 'items.id').orderByRaw('items.id')
            .where({sales_date})
                .then(sale => {
                    if (sale.length) {
                        res.json(sale)
                    } else {
                        res.status(400).json('No Sales Data')
                    }
                })
        .catch((err) => res.status(400).json('Error'))
    }
})

{/*Get on Select Date to populate Sales Tables */}
app.get('/Corntable/:sales_date', (req, res) => {
    const {sales_date} = req.params;
    if (!sales_date) {
        res.status(400).json('No Sales Data')
    } else {
        db.select('total')
            .from('cornsales')
            .where('sales_date', '=', sales_date)
                .then(cornsale => {
                    if (cornsale.length) {
                        res.json(cornsale)
                    } else {
                        res.status(400).json('No Sales Data')
                    }
                })
        .catch((err) => res.status(400).json('Error'))
    }
})

{/*Put on Button Click to update Sales Data */}
app.put('/Updatesales', (req, res) => {
    const {sales} = req.body;
    if (!sales) {
        console.log('Stopped wrong')
        return res.status(400).json('no sales data')
    } else {
        sales.forEach(sale => {
            /*!!!!!! Use a .then() to get result of joining the tables */
            db.select('items.price').from('sales').join('items', 'sales.item_id', 'items.id').where('sales.id', '=', sale.id)
            .then(item_price => {
                /*!!!!!! Get price from joined table */
                price = item_price[0].price
                /*!!!!!! Slice, parseInt and calculate total (need to fix bug with uneven dollar amounts) */
                newTotal = sale.number * parseFloat(price.slice(1))
                /*!!!!!! Console log shows bug with uneven dollar amount -- look where original is 3.50 */
                console.log('Original ' + price.slice(1) + ' New ' + parseInt(price.slice(1)))
                /*!!!!!! Now update sales table */
                db('sales').where('id', '=', sale.id)
                .update({
                    number: sale.number,
                    total: newTotal
                })
                .then( () => {
                    res.json('item updated');
                })
                
                .catch(err => res.status(400).json('Error'))
            })
        })
    }
})

app.put('/Updatecorn', (req, res) => {
    const {sales_date,total} = req.body;
    if (!sales_date) {
        console.log('Stopped wrong')
        return res.status(400).json('no sales data')
    } else {
        db('cornsales').where('sales_date', '=', sales_date)
        .update({
            total: total
        })
        .then( () => {
            res.json('corn updated');
        })
        .catch(err => res.status(400).json('Error'))
    }
})


{/*Get on DidMount in Prices to populate items list */}
app.get('/Pricestable', (req, res) => {
    db.select('*').from('items').orderByRaw('id')
    .then(item => {
        if (item.length) {
            res.json(item)
        } else {
            res.status(400).json('No items in database')
        }
    })
    .catch(err => res.status(400).json('Error Creating Item'))
})

{/*Post on Button Click New Items with Price */}
app.post('/Newitem', (req, res) => {
    const {name, price} = req.body;
    console.log("Name " + name)
    console.log("Price " + price)
    if (!name|| !price) {
        return res.status(400).json('missing fields')
    } else {
    db('items')
        .returning('*')
        .insert ({
            itemname: name,
            price: price
        })
        .then(item => {
            res.json(item[0]);
        }) 
    .catch(err => res.status(400).json('error'))
    }
})

{/*Put on Button Click Update Item with new Price/Name */}
app.put('/Updateitem', (req, res) => {
    const {items} = req.body;
    items.forEach(item => {
        db('items').where('id', '=', item.id)
        .update({
            itemname: item.itemname,
            price: item.price
        })
        .then ( () => {})
        .then( () => {
            res.json('item updated');
        })
        .catch(err => res.status(400).json(err + 'unable to change items'))
    })
})

app.delete('/Deleteitem', (req, res) => {
    const{id} = req.body;
    db('items').del().where({id})
        .then(() => {
            res.json('item deleted')
        })
        .catch(err => res.status(400).json('unable to get item'))
})

app.listen(process.env.PORT || 3000, () => {
    console.log('app is running on port ${process.env.PORT}')
})