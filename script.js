// Create map
var map = L.map('map', {
    center: [0.5, 37.8],
    zoom: 6
});

var servicesData = [];

Papa.parse("data/services_detail.csv", {
    download: true,
    header: true,
    complete: function(results) {
        servicesData = results.data;
        console.log("Services loaded:", servicesData.length);
    }
});

// Basemap
L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    {
        attribution: '&copy; OpenStreetMap &copy; CARTO'
    }
).addTo(map);

// Kenya outline
fetch('data/kenya_outline.geojson')
    .then(response => response.json())
    .then(data => {
        var kenyaOutline = L.geoJSON(data, {
            style: {
                color: '#333',
                weight: 2,
                fill: false
            }
        }).addTo(map);

        map.fitBounds(kenyaOutline.getBounds());
    });


// Subcounties
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

var serviceLayers = {};
var subcountyBoundaries;

function createServiceLayer(data, fieldName, outlineColor) {
    return L.geoJSON(data, {
        style: function(feature) {
            return {
                color: outlineColor,
                weight: 1,
                fillColor: getColor(feature.properties[fieldName], fieldName),
                fillOpacity: 0.7
            };
        },
        onEachFeature: function(feature, layer) {
            layer.on('mouseover', function(e) {
                e.target.setStyle({
                    weight: 2,
                    color: '#000',
                    fillOpacity: 0.9
                });
            });

            layer.on('mouseout', function(e) {
                serviceLayers[fieldName].resetStyle(e.target);
            });

            layer.on('click', function() {
                var props = feature.properties;
                var subcountyName = props.subcounty;

                var filtered = servicesData.filter(function(item) {
                    return item.subcounty === subcountyName;
                });

                var html =
                    '<strong>County:</strong> ' + (props.county || '-') + '<br>' +
                    '<strong>Sub-county:</strong> ' + (props.subcounty || '-') + '<br>' +
                    '<strong>Services found:</strong> ' + filtered.length + '<br><br>';

                if (filtered.length > 0) {
                    html += '<table class="info-table">';
                    html += '<tr><th>Actor</th><th>Target group</th><th>Service category</th></tr>';

                    filtered.forEach(function(service) {
                        html += '<tr>' +
                            '<td>' + (service.actor_name || '-') + '</td>' +
                            '<td>' + (service.target_class || '-') + '</td>' +
                            '<td>' + (service.service_category || '-') + '</td>' +
                            '</tr>';
                    });

                    html += '</table>';
                } else {
                    html += 'No services found for this sub-county.';
                }

                document.getElementById('info').innerHTML = html;
            });
        }
    });
}

fetch('data/subcounties_tweede.geojson')
    .then(response => response.json())
    .then(data => {
        subcountyBoundaries = L.geoJSON(data, {
            interactive: false,
            style: {
                color: "#666",
                weight: 1,
                fillOpacity: 0
            }
        }).addTo(map);

        serviceLayers.children = createServiceLayer(data, "children", "#2b8cbe");
        serviceLayers.disabled = createServiceLayer(data, "disabled", "#756bb1");
        serviceLayers.elderly = createServiceLayer(data, "elderly", "#31a354");

        serviceLayers.children.addTo(map);

                var overlayMaps = {
            "Children services": serviceLayers.children,
            "Disabled services": serviceLayers.disabled,
            "Elderly services": serviceLayers.elderly,
            "Sub-county boundaries": subcountyBoundaries
        };

        L.control.layers(null, overlayMaps, {
            collapsed: false
        }).addTo(map);
    });



// Counties
fetch('data/counties.geojson')
    .then(response => response.json())
    .then(data => {
        L.geoJSON(data, {
            interactive: false,
            style: {
                color: '#444',
                weight: 2,
                fillOpacity: 0
            }
        }).addTo(map);
    });