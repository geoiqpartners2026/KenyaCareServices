// Create map
var map = L.map('map', {
    center: [0.5, 37.8],
    zoom: 6
});

var servicesData = [];
var serviceLayers = {};
var subcountyBoundaries;
var countyBoundaries;
var kenyaOutline;
var subcountyLayerIndex = {};
var currentTableRows = [];
var currentSort = {
    key: "actor",
    asc: true
};

var THEME_LAYER_NAMES = [
    "Children services",
    "Disabled services",
    "Elderly services"
];

// Load CSV
Papa.parse("data/services_detail.csv", {
    download: true,
    header: true,
    complete: function(results) {
        servicesData = results.data.filter(function(row) {
            return row && row.subcounty;
        });
        console.log("Services loaded:", servicesData.length);
    }
});

// Basemap
L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        opacity: 0.85
    }
).addTo(map);
// Scale bar
L.control.scale({
    position: 'bottomleft',
    metric: true,
    imperial: false
}).addTo(map);

// North arrow
var north = L.control({ position: 'topleft' });

north.onAdd = function () {
    var div = L.DomUtil.create('div', 'north-arrow');
    div.innerHTML = '▲<br>N';
    return div;
};

north.addTo(map);

// Hint box
var hint = L.control({ position: 'bottomright' });

hint.onAdd = function () {
    var div = L.DomUtil.create('div', 'map-hint');
    div.innerHTML = 'Click a sub-county to view service details.';
    return div;
};

hint.addTo(map);

// Legend
var legend = L.control({ position: 'bottomleft' });

legend.onAdd = function () {
    var div = L.DomUtil.create('div', 'info legend');
    div.innerHTML = '<b>Legend</b><br>Select a service layer';
    return div;
};

legend.addTo(map);

function updateLegend(type) {
    var div = document.querySelector('.legend');

    var grades;
    var colors;
    var title;

    if (type === "children") {
        title = "Reported services for children";
        grades = [0, 5, 10, 20, 40];
        colors = ["#c6dbef", "#6baed6", "#4292c6", "#2171b5", "#084594"];
    }

    if (type === "disabled") {
        title = "Reported services for persons with disabilities";
        grades = [0, 5, 10, 20, 40];
        colors = ["#dadaeb", "#bcbddc", "#9e9ac8", "#807dba", "#6a51a3"];
    }

    if (type === "elderly") {
        title = "Reported services for elderly people";
        grades = [0, 5, 10, 20, 40];
        colors = ["#c7e9c0", "#a1d99b", "#74c476", "#41ab5d", "#238b45"];
    }

    if (!grades) {
        div.innerHTML = '<b>Legend</b><br>Select a service layer';
        return;
    }

    var html = '<b>' + title + '</b><br>';

    for (var i = 0; i < grades.length; i++) {
        html +=
            '<i style="background:' + colors[i] + '"></i> ' +
            grades[i] + (grades[i + 1] ? '&ndash;' + grades[i + 1] + '<br>' : '+');
    }

    div.innerHTML = html;
}

// Helpers
function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
}

function getCountyName(props) {
    return props.kenya_subcounties_county || props.county || "-";
}

function getSubcountyName(props) {
    return props.subcounty || props.kenya_subcounties_clean_csv_subcounty || "-";
}

function getFilteredServices(subcountyName) {
    var normalized = normalizeText(subcountyName);

    return servicesData.filter(function(item) {
        return normalizeText(item.subcounty) === normalized;
    });
}

function getGroupedRows(filtered) {
    var grouped = {};

    filtered.forEach(function(service) {
        var actor = service.actor_name || "-";

        if (!grouped[actor]) {
            grouped[actor] = {
                actor: actor,
                targetGroups: new Set(),
                categories: new Set(),
                recordCount: 0
            };
        }

        if (service.target_class) {
            grouped[actor].targetGroups.add(service.target_class);
        }

        if (service.service_category) {
            grouped[actor].categories.add(service.service_category);
        }

        grouped[actor].recordCount += 1;
    });

    return Object.keys(grouped).map(function(actor) {
        return {
            actor: grouped[actor].actor,
            targetGroups: Array.from(grouped[actor].targetGroups).sort().join(", "),
            categories: Array.from(grouped[actor].categories).sort().join(", "),
            recordCount: grouped[actor].recordCount
        };
    });
}

function sortTableRows(rows, key, asc) {
    return rows.slice().sort(function(a, b) {
        var valueA = a[key];
        var valueB = b[key];

        if (key === "recordCount") {
            return asc ? valueA - valueB : valueB - valueA;
        }

        valueA = String(valueA || "").toLowerCase();
        valueB = String(valueB || "").toLowerCase();

        if (valueA < valueB) return asc ? -1 : 1;
        if (valueA > valueB) return asc ? 1 : -1;
        return 0;
    });
}

function renderTable() {
    var tbody = document.getElementById("info-table-body");
    if (!tbody) return;

    var sortedRows = sortTableRows(currentTableRows, currentSort.key, currentSort.asc);

    var html = "";
    sortedRows.forEach(function(row) {
        html += '<tr>' +
            '<td>' + escapeHtml(row.actor) + '</td>' +
            '<td>' + escapeHtml(row.targetGroups) + '</td>' +
            '<td>' + escapeHtml(row.categories) + '</td>' +
            '<td>' + row.recordCount + '</td>' +
            '</tr>';
    });

    tbody.innerHTML = html;
}

function attachTableSorting() {
    var headers = document.querySelectorAll(".info-table th.sortable");

    headers.forEach(function(header) {
        header.addEventListener("click", function() {
            var key = this.getAttribute("data-sort");

            if (currentSort.key === key) {
                currentSort.asc = !currentSort.asc;
            } else {
                currentSort.key = key;
                currentSort.asc = true;
            }

            renderTable();
        });
    });
}

function renderInfoPanel(countyName, subcountyName, filtered) {
    var uniqueActors = new Set(
        filtered.map(function(item) {
            return item.actor_name || "-";
        })
    ).size;

    var html =
        '<div class="info-meta">' +
        '<strong>County:</strong> ' + escapeHtml(countyName) + '<br>' +
        '<strong>Sub-county:</strong> ' + escapeHtml(subcountyName) + '<br>' +
        '<strong>Total service records:</strong> ' + filtered.length + '<br>' +
        '<strong>Unique actors:</strong> ' + uniqueActors +
        '</div>' +

        '<div class="info-disclaimer">' +
        'Note: counts reflect reported records in the available dataset and do not necessarily represent full service availability or complete geographic coverage.' +
        '</div>';

    if (filtered.length > 0) {
        currentTableRows = getGroupedRows(filtered);

        html +=
            '<div class="table-wrap">' +
            '<table class="info-table">' +
            '<thead>' +
            '<tr>' +
            '<th class="sortable" data-sort="actor">Actor</th>' +
            '<th class="sortable" data-sort="targetGroups">Target group</th>' +
            '<th class="sortable" data-sort="categories">Service category</th>' +
            '<th class="sortable" data-sort="recordCount">Records</th>' +
            '</tr>' +
            '</thead>' +
            '<tbody id="info-table-body"></tbody>' +
            '</table>' +
            '</div>';
    } else {
        currentTableRows = [];
        html += 'No services found for this sub-county.';
    }

    document.getElementById("info-content").innerHTML = html;

    if (filtered.length > 0) {
        renderTable();
        attachTableSorting();
    }
}

function activateInfoPanel() {
    document.getElementById("info").classList.remove("hidden");
    document.getElementById("map").classList.add("with-info");
    map.invalidateSize();
}

function deactivateInfoPanel() {
    document.getElementById("info").classList.add("hidden");
    document.getElementById("map").classList.remove("with-info");
    map.invalidateSize();
}

// Color function
function getColor(value, type) {
    if (value === null || value === undefined || value === "") return "#f5f5f5";

    if (type === "children") {
        return value > 40 ? "#084594" :
               value > 20 ? "#2171b5" :
               value > 10 ? "#4292c6" :
               value > 5  ? "#6baed6" :
               value > 0  ? "#c6dbef" :
                            "#f5f5f5";
    }

    if (type === "disabled") {
        return value > 40 ? "#6a51a3" :
               value > 20 ? "#807dba" :
               value > 10 ? "#9e9ac8" :
               value > 5  ? "#bcbddc" :
               value > 0  ? "#dadaeb" :
                            "#f5f5f5";
    }

    if (type === "elderly") {
        return value > 40 ? "#238b45" :
               value > 20 ? "#41ab5d" :
               value > 10 ? "#74c476" :
               value > 5  ? "#a1d99b" :
               value > 0  ? "#c7e9c0" :
                            "#f5f5f5";
    }

    return "#f5f5f5";
}

// Create service layer
function createServiceLayer(data, fieldName, outlineColor) {
    return L.geoJSON(data, {
        style: function(feature) {
            return {
                color: outlineColor,
                weight: 0.5,
                fillColor: getColor(feature.properties[fieldName], fieldName),
                fillOpacity: 0.7
            };
        },
        onEachFeature: function(feature, layer) {
            var props = feature.properties;
            var countyName = getCountyName(props);
            var subcountyName = getSubcountyName(props);
            var filtered = getFilteredServices(subcountyName);

            subcountyLayerIndex[normalizeText(subcountyName)] = layer;

            layer.bindTooltip(
                '<strong>' + escapeHtml(subcountyName) + '</strong><br>' +
                'County: ' + escapeHtml(countyName) + '<br>' +
                'Service records: ' + filtered.length,
                {
                    sticky: true,
                    direction: 'top',
                    className: 'subcounty-tooltip'
                }
            );

            layer.on('mouseover', function(e) {
                e.target.setStyle({
                    weight: 1,
color: '#4a5560',
fillOpacity: 0.82
                });
            });

            layer.on('mouseout', function(e) {
                serviceLayers[fieldName].resetStyle(e.target);
            });

            layer.on('click', function() {
                activateInfoPanel();
                renderInfoPanel(countyName, subcountyName, filtered);
            });
        }
    });
}

// Search
function populateSubcountySearch(data) {
    var list = document.getElementById("subcounty-list");
    var names = data.features.map(function(feature) {
        return getSubcountyName(feature.properties);
    });

    var uniqueNames = Array.from(new Set(names)).sort();

    list.innerHTML = "";
    uniqueNames.forEach(function(name) {
        var option = document.createElement("option");
        option.value = name;
        list.appendChild(option);
    });
}

function goToSubcounty() {
    var input = document.getElementById("subcounty-search");
    var query = normalizeText(input.value);

    if (!query) return;

    var layer = subcountyLayerIndex[query];
    if (!layer) {
        alert("Sub-county not found.");
        return;
    }

    map.fitBounds(layer.getBounds(), { maxZoom: 10 });

    var props = layer.feature.properties;
    var countyName = getCountyName(props);
    var subcountyName = getSubcountyName(props);
    var filtered = getFilteredServices(subcountyName);

    activateInfoPanel();
    renderInfoPanel(countyName, subcountyName, filtered);
}

// Load all GeoJSON layers together
Promise.all([
    fetch('data/kenya_outline.geojson').then(response => response.json()),
    fetch('data/subcounties_tweede.geojson').then(response => response.json()),
    fetch('data/counties.geojson').then(response => response.json())
]).then(function([kenyaData, subcountyData, countyData]) {

    kenyaOutline = L.geoJSON(kenyaData, {
        interactive: false,
        style: {
            color: '#333',
            weight: 1.2,
            fill: false
        }
    });

    subcountyBoundaries = L.geoJSON(subcountyData, {
        interactive: false,
        style: {
            color: "#666",
            weight: 0.5,
            fillOpacity: 0
        }
    });

    countyBoundaries = L.geoJSON(countyData, {
        interactive: false,
        style: {
            color: '#444',
            weight: 0.8,
            fillOpacity: 0
        }
    });

    serviceLayers.children = createServiceLayer(subcountyData, "children", "#2b8cbe");
    serviceLayers.disabled = createServiceLayer(subcountyData, "disabled", "#756bb1");
    serviceLayers.elderly = createServiceLayer(subcountyData, "elderly", "#31a354");

    serviceLayers.children.addTo(map);
    updateLegend("children");

    map.fitBounds(kenyaOutline.getBounds());
    populateSubcountySearch(subcountyData);

   var baseMaps = {
    "Children services": serviceLayers.children,
    "Disabled services": serviceLayers.disabled,
    "Elderly services": serviceLayers.elderly
};

var overlayMaps = {
    "Kenya outline": kenyaOutline,
    "County boundaries": countyBoundaries,
    "Sub-county boundaries": subcountyBoundaries
};

L.control.layers(baseMaps, overlayMaps, {
    collapsed: false
}).addTo(map);

map.on('baselayerchange', function(e) {
    if (e.name === "Children services") updateLegend("children");
    if (e.name === "Disabled services") updateLegend("disabled");
    if (e.name === "Elderly services") updateLegend("elderly");
});

    map.on('overlayremove', function(e) {
        if (THEME_LAYER_NAMES.includes(e.name)) {
            if (map.hasLayer(serviceLayers.children)) {
                updateLegend("children");
            } else if (map.hasLayer(serviceLayers.disabled)) {
                updateLegend("disabled");
            } else if (map.hasLayer(serviceLayers.elderly)) {
                updateLegend("elderly");
            } else {
                document.querySelector('.legend').innerHTML = '<b>Legend</b><br>Select a service layer';
            }
        }
    });
});

// Search events
document.getElementById("search-btn").addEventListener("click", goToSubcounty);

document.getElementById("subcounty-search").addEventListener("keydown", function(e) {
    if (e.key === "Enter") {
        goToSubcounty();
    }
});

// Close info panel
document.getElementById('close-info').addEventListener('click', function() {
    deactivateInfoPanel();
});