// Log data from console to a file
function init() {
    Tabletop.init( { key: public_spreadsheet_url,
        callback: showInfo,
        simpleSheet: true } )
  }

function showInfo(data, tabletop) {
    alert("Successfully processed!")
    console.log(data);
    console.save(data, console.json)
  }
function(console) {
    console.save = function(data, filename){

    if(!data) {
        console.error('Console.save: No data')
        return;
    }

    if(!filename) filename = 'console.json'

    if(typeof data === "object"){
        data = JSON.stringify(data, undefined, 4)
    }

    var blob = new Blob([data], {type: 'text/json'}),
        e    = document.createEvent('MouseEvents'),
        a    = document.createElement('a')

    a.download = filename
    a.href = window.URL.createObjectURL(blob)
    a.dataset.downloadurl =  ['text/json', a.download, a.href].join(':')
    e.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null)
    a.dispatchEvent(e)
}