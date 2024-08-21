//Dashboard Settings
window.addEventListener('load', function() {
    var input, filter, table, tr, td, i, value, rowCounter

    var input = document.getElementById('searchListAssets');
    var clearSearch = document.getElementById('clearSearch');
    var notFound = document.getElementsByClassName('noAssets')[0];

    function searchAssets() {
        rowCounter = 0;
        filter = input.value.toUpperCase();
        table = document.getElementById('tableAssets')
        tr = table.getElementsByTagName('tr')

        // munculin X
        if (filter != "") {
            clearSearch.style.visibility = 'visible'
        } else {
            clearSearch.style.visibility = 'hidden'
        }

        for (let i = 0; i < tr.length; i++) {
            td = tr[i].getElementsByTagName('td')[2];
            if (td) {
                value = td.textContent.toUpperCase() || td.innerText;
                if (value.indexOf(filter) >= 0) {
                    tr[i].style.display = ""
                    rowCounter++
                } else {
                    tr[i].style.display = "none"
                }
            }
        }

        if (rowCounter == 0) {
            notFound.setAttribute('style', 'display: flex')
            table.style.display = 'none'
        } else {
            notFound.setAttribute('style', 'display: none')
            table.style.display = 'table'
        }

    }

    function clear() {
        input.value = ""
        searchAssets()
    }

    clearSearch.addEventListener('click', clear)
    input.addEventListener('keyup', searchAssets)
})