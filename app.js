"use strict";

const blue = "#063ba0";
const cyan = "#77d5ff";
const yellow = "#ffd64a";
const attribution = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const osmTiles = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const panel = document.querySelector("#panel");
const openPanel = document.querySelector("#open-panel");
const closePanel = document.querySelector("#close-panel");
const status = document.querySelector("#status");
const reset = document.querySelector("#reset");
const exportButton = document.querySelector("#export-map");
const reportCredit = "Análisis preparado por Schubert Lombaida";

function setPanel(open) {
  panel.classList.toggle("open", open);
  openPanel.setAttribute("aria-expanded", String(open));
  (open ? closePanel : openPanel).focus();
}
openPanel.addEventListener("click", () => setPanel(true));
closePanel.addEventListener("click", () => setPanel(false));
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && panel.classList.contains("open")) setPanel(false);
});

async function readData(filename) {
  if (window.embeddedMapData?.[filename]) return window.embeddedMapData[filename];
  const response = await fetch("data/" + filename);
  if (!response.ok) throw new Error(filename + " " + response.status);
  return response.json();
}

function popup(title, properties, latlng, fallback) {
  const element = document.createElement("div");
  const heading = document.createElement("strong");
  heading.textContent = title;
  element.append(heading);
  const facts = document.createElement("dl");
  const rows = [
    ["Sector", properties.sector],
    ["Cota del archivo", properties.cota_m !== undefined ? properties.cota_m + " m" : null],
    ["Coordenadas", latlng.lat.toFixed(6) + ", " + latlng.lng.toFixed(6)],
    ["Fuente", properties.source || properties.origen || fallback],
    ["Estado", properties.destino || properties.estado ||
      (properties.classification ? "Recorrido potencial modelado" : null)]
  ];
  for (const [label, value] of rows) {
    if (!value) continue;
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value;
    facts.append(dt, dd);
  }
  element.append(facts);
  return element;
}

function labelIcon(text, className) {
  const content = document.createElement("span");
  content.textContent = text;
  return L.divIcon({html: content, className: "map-label " + className, iconSize: [0, 0], iconAnchor: [-7, 7]});
}

function layerControl(map, container, id, title, layer, enabled, color, kind = "") {
  const row = document.createElement("label");
  row.className = "choice";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.id = id;
  input.checked = enabled;
  const text = document.createElement("span");
  text.textContent = title;
  row.append(input, text);
  if (color) {
    const swatch = document.createElement("span");
    swatch.className = "swatch " + kind;
    swatch.style.setProperty("--swatch", color);
    swatch.setAttribute("aria-hidden", "true");
    row.append(swatch);
  }
  container.append(row);
  if (enabled) layer.addTo(map);
  input.addEventListener("change", () => {
    if (input.checked) layer.addTo(map);
    else map.removeLayer(layer).closePopup();
  });
}

function asset(file) {
  return window.embeddedMapImages?.[file] || "data/" + file;
}

async function start() {
  const filenames = [
    "encuadre.json", "base_cartografica.geojson", "superficies_base.geojson",
    "escorrentias_potenciales.geojson", "ramales_orientales.geojson",
    "escorrentias_C03_C05.geojson", "cruces_via_baltra.geojson", "corredor_vial_baltra.geojson",
    "referencias.geojson", "cascada_referencia_y_celda.geojson", "encanada_DWG.geojson",
    "entorno_referencial_cascada.geojson", "vias_diango.geojson",
    "lluvia.json", "afectacion_sngr.geojson", "satellite.json", "igm-vias.geojson", "igm-rios.geojson", "sitrep06_vector.geojson", "barrios.geojson", "kml-catalog.json"
  ];
  const [view, base, land, drains, east, c0305, crossings, road, refs, cascade, cad, vicinity, referenceRoads, rain, sngr, satellite, igmRoads, igmRivers, sitrep06, neighborhoods, kmlCatalog] =
    await Promise.all(filenames.map(readData));

  const map = L.map("map", {zoomSnap: .25, maxZoom: 20});
  for (const [name, order] of Object.entries({refSurface: 245, refRoad: 250, surface: 260, localRoad: 275, satelliteBase: 285, photo: 295, relief: 305, accumulation: 320, cad: 330, supplied: 355, drains: 380, official: 390, casing: 415, priority: 425, points: 475})) {
    map.createPane(name).style.zIndex = order;
  }
  const recenter = () => map.fitBounds(view.initialBounds, {padding: [16, 24], animate: false});
  recenter();
  reset.disabled = false;
  reset.addEventListener("click", recenter);
  L.control.scale({imperial: false}).addTo(map);
  map.attributionControl.setPrefix(false);
  map.attributionControl.addAttribution(attribution);

  const localBase = L.layerGroup([
    L.geoJSON(land, {pane: "surface", interactive: false, style: feature => ({
      fillColor: ({land: "#f4f6ee", residential: "#eee9dc", wood: "#dbe8d5", forest: "#dbe8d5",
        scrub: "#e2eddc", meadow: "#e8efdf", water: "#dcebef"})[feature.properties.kind],
      fillOpacity: 1, stroke: false
    })}),
    L.geoJSON(base, {pane: "localRoad", interactive: false, style: feature => {
      const p = feature.properties;
      const major = ["primary", "secondary", "trunk", "tertiary"].includes(p.highway);
      return {color: p.natural === "coastline" ? "#638b92" : major ? "#878061" : "#8d9586",
        weight: major ? 1.65 : .75, opacity: .9};
    }})
  ]).addTo(map);

  const projectCheck = document.querySelector("#base-project");
  const referenceCheck = document.querySelector("#base-reference");
  const onlineCheck = document.querySelector("#base-online");
  const slider = document.querySelector("#base-opacity");
  const opacityValue = document.querySelector("#opacity-value");
  const help = document.querySelector("#base-help");
  const hosted = /^https?:$/.test(location.protocol);
  onlineCheck.disabled = !hosted;
  help.textContent = hosted
    ? "Puedes activar ambos fondos y regular la opacidad del proyecto."
    : "La referencia incluida funciona sin conexión. Las teselas en línea se habilitan al publicar el visor.";

  const referenceBase = L.layerGroup([
    L.rectangle(view.initialBounds, {pane: "refSurface", interactive: false, stroke: false, fillColor: "#eef0e8", fillOpacity: 1}),
    L.geoJSON(land, {pane: "refSurface", interactive: false, style: feature => ({
      stroke: false, fillOpacity: 1,
      fillColor: ({land: "#f4f0e5", residential: "#eaded2", wood: "#dee6d4", forest: "#dee6d4",
        scrub: "#e3ead8", meadow: "#e8ecd9", water: "#cfe7f3"})[feature.properties.kind]
    })}),
    L.geoJSON(base, {pane: "refRoad", interactive: false, style: f => ({
      color: f.properties.natural === "coastline" ? "#54889e" : "#788691", weight: 1, opacity: .75
    })}),
    L.geoJSON(referenceRoads, {pane: "refRoad", interactive: false, style: f => ({
      color: f.properties.name === "Avenida Baltra" ? "#b65038" : "#675f7a", weight: f.properties.name ? 1.65 : .85, opacity: .8
    })})
  ]);

  // Inspect HTTP status before decoding, so a 403 image never becomes a map tile.
  const CheckedTiles = L.TileLayer.extend({
    createTile(coords, done) {
      const image = document.createElement("img");
      image.alt = "";
      const controller = new AbortController();
      image.stopTile = () => controller.abort();
      fetch(this.getTileUrl(coords), {signal: controller.signal, referrerPolicy: "strict-origin-when-cross-origin"})
        .then(response => {
          if (!response.ok || !response.headers.get("Content-Type")?.startsWith("image/")) {
            throw new Error("Tesela HTTP " + response.status);
          }
          return response.blob();
        })
        .then(blob => {
          if (controller.signal.aborted) return;
          const url = URL.createObjectURL(blob);
          image.onload = () => { URL.revokeObjectURL(url); done(null, image); };
          image.onerror = () => { URL.revokeObjectURL(url); done(new Error("Tesela inválida"), image); };
          image.src = url;
        })
        .catch(error => { if (!controller.signal.aborted) done(error, image); });
      return image;
    }
  });
  const remoteBase = new CheckedTiles(osmTiles, {maxNativeZoom: 19, maxZoom: 20});
  remoteBase.on("tileunload", event => event.tile.stopTile?.());

  function setLayer(layer, enabled) {
    if (enabled) {
      if (!map.hasLayer(layer)) layer.addTo(map);
    } else if (map.hasLayer(layer)) map.removeLayer(layer);
  }
  function updateBases() {
    const compare = projectCheck.checked && referenceCheck.checked;
    const opacity = compare ? slider.value / 100 : 1;
    slider.disabled = !compare;
    opacityValue.textContent = slider.value + " %";
    for (const pane of ["surface", "localRoad"]) map.getPane(pane).style.opacity = opacity;
    onlineCheck.disabled = !hosted || !referenceCheck.checked;
    setLayer(localBase, projectCheck.checked);
    const online = hosted && referenceCheck.checked && onlineCheck.checked;
    setLayer(referenceBase, referenceCheck.checked && !online);
    setLayer(remoteBase, online);
  }
  remoteBase.on("tileerror", () => {
    if (!map.hasLayer(remoteBase)) return;
    onlineCheck.checked = false;
    status.textContent = "OpenStreetMap en línea no está disponible. Se muestra la referencia incluida.";
    status.hidden = false;
    updateBases();
  });
  for (const input of [projectCheck, referenceCheck, onlineCheck]) {
    input.addEventListener("change", () => {
      status.hidden = true;
      updateBases();
    });
  }
  slider.addEventListener("input", updateBases);
  updateBases();


  const satelliteCheck = document.querySelector("#satellite-basemap");
  const satelliteSlider = document.querySelector("#satellite-opacity");
  const satelliteValue = document.querySelector("#satellite-opacity-value");
  const satelliteCredit = 'EOxCloudless 2025 — <a href="https://maps.eox.at/">EOX</a> (Contains modified Copernicus Sentinel data 2025), <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/">CC BY-NC-SA 4.0</a>';
  const satelliteBase = new CheckedTiles(
    "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2025_3857/default/g/{z}/{y}/{x}.jpg",
    {pane: "satelliteBase", maxNativeZoom: 14, maxZoom: 20, minZoom: 0, opacity: .85, attribution: satelliteCredit}
  );
  satelliteBase.on("tileunload", event => event.tile.stopTile?.());
  satelliteBase.on("loading", () => { map.getContainer().dataset.satelliteLoading = "true"; });
  satelliteBase.on("load", () => { map.getContainer().dataset.satelliteLoading = "false"; });
  satelliteBase.on("tileerror", () => {
    if (!map.hasLayer(satelliteBase)) return;
    satelliteCheck.checked = false;
    satelliteSlider.disabled = true;
    map.removeLayer(satelliteBase);
    map.getContainer().dataset.satelliteLoading = "false";
    status.textContent = "La imagen satelital no está disponible. Puedes continuar con la cartografía incluida.";
    status.hidden = false;
  });
  satelliteCheck.addEventListener("change", () => {
    status.hidden = true;
    satelliteSlider.disabled = !satelliteCheck.checked;
    setLayer(satelliteBase, satelliteCheck.checked);
    if (!satelliteCheck.checked) map.getContainer().dataset.satelliteLoading = "false";
  });
  satelliteSlider.addEventListener("input", () => {
    satelliteBase.setOpacity(satelliteSlider.value / 100);
    satelliteValue.textContent = satelliteSlider.value + " %";
  });

  const hydro = document.querySelector("#hydro-layers");
  const refsPanel = document.querySelector("#reference-layers");
  const model = "Copernicus GLO-30 · modelo de drenaje D8";
  function routes(data, title, color, weight, dash = "", edge = null, source = model, pane = "priority") {
    const styling = {pane, color, weight, dashArray: dash, lineCap: "round"};
    const interactive = L.geoJSON(data, {pane, style: styling, onEachFeature: (feature, layer) => {
      layer.on("click", event => {
        L.popup().setLatLng(event.latlng).setContent(popup(title, feature.properties, event.latlng, source)).openOn(map);
      });
    }});
    return edge ? L.layerGroup([
      L.geoJSON(data, {pane: "casing", interactive: false, style: {...styling, pane: "casing", color: edge, weight: weight + 2.1}}),
      interactive
    ]) : interactive;
  }

  layerControl(map, hydro, "east", "Ramales orientales · La Cascada",
    routes(east, "Ramales orientales", blue, 2.5, "5 4", yellow), true, "#bd9a24", "dash");
  for (const id of ["C03", "C05"]) {
    const data = {...c0305, features: c0305.features.filter(feature => feature.properties.cruce === id)};
    layerControl(map, hydro, id.toLowerCase(), "Escorrentía " + id,
      routes(data, "Escorrentía " + id, blue, 2.2, "4 3", cyan), true, "#247ebe", "dash");
  }
  layerControl(map, hydro, "drains", "Otras escorrentías potenciales",
    routes(drains, "Escorrentía potencial", "#43819a", 1.15, "3 3", null, model, "drains"), true, "#43819a", "dash");
  layerControl(map, hydro, "cad-axis", "Eje de la encañada del DWG",
    routes(cad, "Eje de la encañada", blue, 2.1, "", cyan, "Plano DWG · posición referencial"), true, blue);
  const dwg = L.imageOverlay(asset("detalle-dwg.webp"), view.dwgBounds, {pane: "cad"});
  layerControl(map, hydro, "cad-detail", "Detalle circular del DWG", dwg, true, "#dc791f");

  layerControl(map, refsPanel, "road", "Vía a Baltra",
    routes(road, "Corredor vial hacia Baltra", "#815a38", 2, "", null, "OpenStreetMap", "drains"), true, "#815a38");
  const crossingLayer = L.geoJSON(crossings, {
    pane: "points",
    pointToLayer: (f, ll) => L.circleMarker(ll, {
      radius: 5, color: "#57431b", weight: 1.15, fillColor: yellow, fillOpacity: 1, className: "crossing-marker"
    }).bindTooltip(f.properties.id, {direction: "right"}),
    onEachFeature: (feature, layer) => {
      const p = feature.properties;
      layer.bindPopup(popup("Cruce " + p.id, p, layer.getLatLng(), "Modelo de drenaje D8 y vía de OpenStreetMap"));
    }
  });
  layerControl(map, refsPanel, "crossings", "Cruces con la vía a Baltra", crossingLayer, true, yellow, "dot");

  const cascadaPoint = cascade.features[0];
  const cascadaLL = L.latLng(cascadaPoint.geometry.coordinates[1], cascadaPoint.geometry.coordinates[0]);
  const cascadeMarker = L.circleMarker(cascadaLL, {pane: "points", radius: 5, color: blue, weight: 2, fillColor: "#fff", fillOpacity: 1});
  cascadeMarker.bindPopup(popup("La Cascada", {}, cascadaLL, "Referencia del mapa de la Secretaría Nacional de Gestión de Riesgos"));
  const cascadeGroup = L.layerGroup([
    L.geoJSON(vicinity, {pane: "points", interactive: false, style: {color: blue, dashArray: "3 3", fill: false, weight: 1}}),
    cascadeMarker,
    L.marker(cascadaLL, {icon: labelIcon("La Cascada", "ref"), interactive: false, keyboard: false})
  ]);
  layerControl(map, refsPanel, "cascada", "La Cascada", cascadeGroup, true, blue, "dot");

  const places = L.layerGroup();
  for (const feature of refs.features) {
    const name = feature.properties.name;
    if (name.startsWith("La Cascada") || name === "Bellavista") continue;
    const [lng, lat] = feature.geometry.coordinates;
    const ll = L.latLng(lat, lng);
    const isSchool = name === "Tomás de Berlanga";
    const isTown = name === "Puerto Ayora";
    const display = isSchool ? "Escuela Tomás de Berlanga" : name;
    if (isTown || isSchool) {
      L.marker(ll, {icon: labelIcon(display, isTown ? "town" : "ref"), interactive: false, keyboard: false}).addTo(places);
    }
    L.circleMarker(ll, {pane: "points", radius: isTown || isSchool ? 3.5 : 2.3, color: "#40554e",
      weight: 1.05, fillColor: "#fff", fillOpacity: 1})
      .bindPopup(popup(display, feature.properties, ll, "OpenStreetMap")).addTo(places);
  }
  const [southWest, northEast] = view.dwgBounds;
  const approvedLabel = [northEast[0] - .00055, southWest[1] + .0144];
  L.marker(approvedLabel, {icon: labelIcon("Bellavista", "town"), interactive: false, keyboard: false}).addTo(places);
  layerControl(map, refsPanel, "places", "Poblados y referencias", places, true, "#40554e", "dot");


  const neighborhoodLabels = L.layerGroup();
  const neighborhoodEntries = [];
  for (const feature of neighborhoods.features) {
    const [lng, lat] = feature.geometry.coordinates;
    const ll = L.latLng(lat, lng);
    const marker = L.marker(ll, {
      icon: labelIcon(feature.properties.name, "neighborhood"), keyboard: true
    }).bindPopup(popup(feature.properties.name, feature.properties, ll, "Referencia cartográfica"));
    neighborhoodLabels.addLayer(marker);
    const leader = L.polyline([], {color: "#637b69", weight: .8, opacity: .7, interactive: false, pane: "supplied"});
    neighborhoodLabels.addLayer(leader);
    neighborhoodEntries.push({marker, leader, anchor: ll});
  }
  layerControl(map, refsPanel, "neighborhoods", "Barrios y sectores", neighborhoodLabels, true, "#526d55");

  function arrangeNeighborhoodLabels() {
    if (!map.hasLayer(neighborhoodLabels)) return;
    const viewport = map.getContainer().getBoundingClientRect();
    const occupied = [...map.getContainer().querySelectorAll(".map-label:not(.neighborhood) span")].map(element => {
      const r = element.getBoundingClientRect();
      return {x: r.left - viewport.left, y: r.top - viewport.top, w: r.width + 5, h: r.height + 5};
    });
    const dimensions = map.getSize();
    const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x &&
      a.y < b.y + b.h && a.y + a.h > b.y;
    for (const {marker, leader, anchor} of neighborhoodEntries) {
      const element = marker.getElement()?.querySelector("span");
      if (!element) continue;
      const point = map.latLngToContainerPoint(anchor);
      const bounds = element.getBoundingClientRect();
      const width = bounds.width + 6;
      const height = bounds.height + 6;
      const candidates = [];
      for (const distance of [0, 20, 40, 65, 90, 120, 155]) {
        const offsets = distance === 0 ? [[8, -8]] :
          [[8, -distance], [8, distance], [-width - 8, -distance], [-width - 8, distance],
           [distance, -8], [-width - distance, -8]];
        for (const [dx, dy] of offsets) {
          const rect = {x: point.x + dx, y: point.y + dy, w: width, h: height};
          if (rect.x >= 5 && rect.y >= 44 && rect.x + width < dimensions.x - 5 &&
              rect.y + height < dimensions.y - 22 && !occupied.some(other => overlap(rect, other))) {
            candidates.push(rect);
          }
        }
        if (candidates.length) break;
      }
      if (!candidates.length) {
        marker.setOpacity(0);
        leader.setLatLngs([]);
        continue;
      }
      const rect = candidates[0];
      occupied.push(rect);
      marker.setOpacity(1);
      marker.setLatLng(map.containerPointToLatLng([rect.x - 7, rect.y + 7]));
      const end = map.containerPointToLatLng([rect.x, rect.y + height / 2]);
      leader.setLatLngs(point.distanceTo(map.latLngToContainerPoint(end)) > 24 ? [anchor, end] : []);
    }
  }
  const scheduleLabels = () => requestAnimationFrame(arrangeNeighborhoodLabels);
  map.on("zoomend moveend resize", scheduleLabels);
  document.getElementById("neighborhoods").addEventListener("change", scheduleLabels);
  scheduleLabels();

  const terrain = document.querySelector("#terrain-layers");
  const official = document.querySelector("#official-layers");
  function textLink(url, text) {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = text;
    return link;
  }
  function imageLayer(id, name, filename, pane, opacity, note, source, scaleBands, options = {}) {
    const imageContainer = options.container || (pane === "photo" ? document.querySelector("#sector-kml-layers") : terrain);
    const layer = L.imageOverlay(asset(filename), options.bounds || view.initialBounds, {pane, opacity});
    layerControl(map, imageContainer, id, name, layer, false);
    const details = document.createElement("div");
    details.hidden = true;
    const description = document.createElement("p");
    description.className = "layer-note";
    description.append(note, " ", textLink(source, "Fuente"));
    details.append(description);
    if (scaleBands) {
      const key = document.createElement("div");
      key.className = "acc-legend";
      for (const [threshold, color] of scaleBands) {
        const item = document.createElement("span");
        item.textContent = threshold;
        item.style.setProperty("--band", color);
        key.append(item);
      }
      details.append(key);
    }
    const range = document.createElement("input");
    range.type = "range";
    range.min = "10";
    range.max = "100";
    range.value = Math.round(opacity * 100);
    range.className = "layer-opacity";
    range.setAttribute("aria-label", "Opacidad de " + name);
    range.addEventListener("input", () => layer.setOpacity(range.value / 100));
    details.append(range);
    imageContainer.append(details);
    const checkbox = document.getElementById(id);
    checkbox.addEventListener("change", () => { details.hidden = !checkbox.checked; });
    return layer;
  }
  const demSource = "https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM";
  imageLayer("relief", "Relieve sombreado", "relieve.webp", "relief", .62,
    "Sombreado derivado del modelo Copernicus GLO-30 de 30 m.", demSource);
  imageLayer("accumulation", "Acumulación de escorrentía", "acumulacion.webp", "accumulation", .8,
    "Área aportante modelada, en km² (umbrales inferiores).", demSource,
    [["0,025","#4392ab"],["0,1","#18719c"],["0,25","#184c90"],["1","#3f2c83"],["5","#681b6a"]]);
  for (const scene of satellite.scenes) {
    const label = scene.id === "antes" ? "Antes" : "Después";
    imageLayer("sat-" + scene.id, "Sentinel-2 · " + label + " · " + scene.date, scene.filename, "photo", .86,
      scene.clouds.toLocaleString("es", {maximumFractionDigits: 1}) +
      " % de nubes en el corredor según la clasificación de la escena. Comparación visual limitada.", scene.source);
  }


  const sectorColors = {"La Cascada": "#da5667", "Los Arrayanes": "#e28a36", "La Unión": "#389773"};
  const floods = L.geoJSON(sngr, {
    pane: "official",
    style: f => {
      const sector = f.properties.kind === "sector";
      const color = sector ? sectorColors[f.properties.name] : "#94443d";
      return {color, fillColor: color, fillOpacity: .27, weight: sector ? 1.7 : 2.65, dashArray: sector ? "" : "7 4"};
    },
    pointToLayer: (feature, ll) => L.circleMarker(ll, {radius: 3.8, color: "#733b29", fillColor: "#ffae66", fillOpacity: 1, weight: 1}),
    onEachFeature: (feature, layer) => {
      layer.on("click", event => {
        const p = feature.properties;
        const item = popup(p.name, p, event.latlng, p.source);
        item.classList.add("source-popup");
        item.append(textLink(p.url, "Ver mapa original y profundidades · corte 4 nov. 2026"));
        L.popup().setLatLng(event.latlng).setContent(item).openOn(map);
      });
    }
  });
  layerControl(map, official, "sngr", "Afectaciones La Cascada · SNGR", floods, false, "#c56d52");
  const officialNote = document.createElement("p");
  officialNote.className = "layer-note";
  officialNote.append(textLink(sngr.features[0].properties.url, "Mapa oficial · corte 4 de noviembre de 2026"));
  official.append(officialNote);


  const reconstructed = L.geoJSON(sitrep06, {
    pane: "official",
    style: feature => {
      const p = feature.properties;
      const color = p.kind === "sector" ? sectorColors[p.name] :
        p.kind === "canada" ? "#823d39" : "#2f9fc6";
      return {color, fillColor: color, fillOpacity: .2, weight: p.kind === "sector" ? 2 : 2.4};
    },
    pointToLayer: (feature, ll) => L.circleMarker(ll, {
      pane: "points", radius: 4, color: "#8e4c21", fillColor: "#ea922e", fillOpacity: 1, weight: 1
    }),
    onEachFeature: (feature, layer) => layer.on("click", event => {
      const p = feature.properties;
      const item = popup(p.name, p, event.latlng, p.source);
      item.append(textLink(p.url, "Documento original · última página"));
      L.popup().setLatLng(event.latlng).setContent(item).openOn(map);
    })
  });
  layerControl(map, official, "sitrep06", "Mapa SNGR · SitRep 06 · vectorial", reconstructed, false, "#2f9fc6");

  const sectorLegend = document.createElement("div");
  sectorLegend.className = "sector-legend";
  sectorLegend.hidden = true;
  const legendTitle = document.createElement("strong");
  legendTitle.textContent = "Sectores afectados · SNGR";
  sectorLegend.append(legendTitle);
  for (const [name, color] of Object.entries(sectorColors)) {
    const row = document.createElement("div");
    const chip = document.createElement("span");
    chip.className = "sector-chip";
    chip.style.backgroundColor = color;
    row.append(chip, name);
    sectorLegend.append(row);
  }
  const legendExplanation = document.createElement("p");
  legendExplanation.textContent = "Cada color identifica un sector afectado. Las profundidades modeladas del mapa original usan una escala de azules.";
  sectorLegend.append(legendExplanation);
  official.append(sectorLegend);
  function updateSectorLegend() {
    sectorLegend.hidden = !document.getElementById("sngr").checked &&
      !document.getElementById("sitrep06").checked;
  }
  for (const id of ["sngr", "sitrep06"]) {
    document.getElementById(id).addEventListener("change", updateSectorLegend);
  }
  const vectorActions = document.createElement("p");
  vectorActions.className = "layer-note";
  const focusVector = document.createElement("button");
  focusVector.type = "button";
  focusVector.textContent = "Ver La Cascada ampliada";
  focusVector.addEventListener("click", () => {
    document.getElementById("sitrep06").checked = true;
    updateSectorLegend();
    if (!map.hasLayer(reconstructed)) reconstructed.addTo(map);
    map.fitBounds(reconstructed.getBounds(), {padding: [24, 24]});
    if (window.innerWidth <= 700) setPanel(false);
  });
  vectorActions.append(focusVector);
  official.append(vectorActions);

  layerControl(map, official, "igm-vias", "Red vial oficial · IGM 1:25.000",
    routes(igmRoads, "Vía cartografiada", "#85593e", 1.2, "", null, "Instituto Geográfico Militar", "official"), false, "#85593e");
  layerControl(map, official, "igm-rios", "Cursos de agua · IGM 1:25.000",
    routes(igmRivers, "Curso cartografiado", "#025d88", 1.5, "", null, "Instituto Geográfico Militar", "official"), false, "#025d88");

  function rainfallPopup(station) {
    const content = document.createElement("div");
    content.className = "rain-popup";
    const heading = document.createElement("strong");
    heading.textContent = "Lluvia histórica · " + station.name;
    const period = document.createElement("p");
    period.textContent = station.altitude + " m s. n. m. · " + station.period.join(" a ");
    const year = document.createElement("select");
    year.setAttribute("aria-label", "Año de lluvia en " + station.name);
    const years = [...new Set(station.months.map(row => row[0]))].reverse();
    for (const value of years) year.add(new Option(value, value));
    year.value = years.find(value => station.months.filter(row => row[0] === value && row[3] === row[4]).length === 12) || years[0];
    const chart = document.createElement("div");
    chart.className = "rain-chart";
    const info = document.createElement("p");
    const table = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Ver valores mensuales";
    const list = document.createElement("ul");
    table.append(summary, list);
    function draw() {
      const rows = new Map(station.months.filter(row => row[0] === Number(year.value)).map(row => [row[1], row]));
      const eligible = [...rows.values()].filter(row => row[3] === row[4]);
      const maximum = Math.max(1, ...eligible.map(row => row[2]));
      chart.replaceChildren();
      list.replaceChildren();
      const labels = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
      for (const [index, label] of labels.entries()) {
        const row = rows.get(index + 1);
        const complete = row && row[3] === row[4];
        const entry = document.createElement("div");
        entry.className = "rain-bar" + (complete ? "" : " missing");
        const value = complete ? row[2].toLocaleString("es") + " mm" : row ? "incompleto (" + row[3] + "/" + row[4] + " días)" : "sin datos";
        entry.title = label + " · " + value;
        const bar = document.createElement("i");
        if (complete) bar.style.height = Math.max(1, row[2] / maximum * 60) + "px";
        entry.append(bar, label[0]);
        chart.append(entry);
        const li = document.createElement("li");
        li.textContent = entry.title;
        list.append(li);
      }
      info.textContent = "Totales de meses completos. Gris indica días faltantes.";
    }
    year.addEventListener("change", draw);
    draw();
    content.append(heading, period, year, chart, info, table,
      textLink(station.source, "Fundación Charles Darwin · dataZone"),
      textLink("https://creativecommons.org/licenses/by-nc-sa/4.0/", "Datos de la estación · CC BY-NC-SA 4.0"));
    return content;
  }
  const stations = L.layerGroup(rain.stations.map(station =>
    L.circleMarker([station.coordinates[1], station.coordinates[0]], {
      pane: "points", radius: 6, color: "#22516c", fillColor: "#79cae5", fillOpacity: 1, weight: 1.6, className: "rain-station"
    }).bindTooltip("Estación " + station.name).bindPopup(() => rainfallPopup(station), {maxWidth: 295, maxHeight: 255, autoPanPaddingTopLeft: [12, 22], autoPanPaddingBottomRight: [12, 20]})
  ));
  layerControl(map, official, "rain-stations", "Estaciones y lluvia histórica", stations, false, "#79cae5", "dot");


  const suppliedGroups = {
    "catastro-2021": "#cadastre-layers",
    "predios-rurales": "#cadastre-layers",
    "curvas-nivel": "#terrain-kml-layers",
    "batimetria": "#terrain-kml-layers",
    "drenajes-kml": "#hydro-layers",
    "aguacatal-25m": "#hydro-layers",
    "divino-nino": "#sector-kml-layers",
    "fabricio-valverde": "#sector-kml-layers",
    "reciclaje-fv": "#sector-kml-layers"
  };
  for (const entry of kmlCatalog.layers) {
    const suppliedContainer = document.querySelector(suppliedGroups[entry.id]);
    const group = L.layerGroup();
    layerControl(map, suppliedContainer, "kml-" + entry.id, entry.title, group, false, entry.color);
    const checkbox = document.getElementById("kml-" + entry.id);
    const note = document.createElement("p");
    note.className = "layer-note";
    note.textContent = entry.note;
    suppliedContainer.append(note);
    const tools = document.createElement("div");
    tools.className = "supplied-tools";
    const zoom = document.createElement("button");
    zoom.type = "button";
    zoom.textContent = "Ver zona";
    const opacity = document.createElement("input");
    opacity.type = "range";
    opacity.min = "10";
    opacity.max = "100";
    opacity.value = entry.type === "image" ? "85" : "75";
    opacity.setAttribute("aria-label", "Opacidad de " + entry.title);
    tools.append(zoom, opacity);
    suppliedContainer.append(tools);
    let loaded = false;
    let pending;
    function applyOpacity() {
      const alpha = opacity.value / 100;
      group.eachLayer(layer => {
        if (layer.setOpacity) layer.setOpacity(alpha);
        else if (layer.setStyle) layer.setStyle({opacity: alpha, fillOpacity: .13 * alpha});
      });
    }
    async function loadLayer() {
      if (loaded) return;
      if (pending) return pending;
      pending = (async () => {
        note.textContent = "Cargando " + entry.title + "…";
        if (entry.type === "image") {
          const image = L.imageOverlay(asset(entry.file), entry.bounds, {pane: "photo", opacity: opacity.value / 100});
          image.on("error", () => {
            note.textContent = "No se pudo abrir la imagen. Desactiva y vuelve a activar esta capa.";
          });
          group.addLayer(image);
        } else {
          const collection = await readData(entry.file);
          const polygon = ["catastro-2021", "predios-urbanos", "predios-rurales", "divino-nino",
            "aguacatal-25m", "fabricio-valverde"].includes(entry.id);
          const layer = L.geoJSON(collection, {
            pane: "supplied",
            style: {color: entry.color, weight: polygon ? 1 : 1.2,
              fill: polygon, fillColor: entry.color, fillOpacity: .1, opacity: .75},
            pointToLayer: (f, ll) => L.circleMarker(ll, {radius: 4, color: entry.color}),
            onEachFeature: (feature, item) => {
              item.on("click", event => {
                const content = popup(feature.properties.name || entry.title,
                  feature.properties, event.latlng, entry.source);
                L.popup({maxWidth: 290}).setLatLng(event.latlng).setContent(content).openOn(map);
              });
            }
          });
          group.addLayer(layer);
        }
        loaded = true;
        applyOpacity();
        note.textContent = entry.note;
      })().catch(error => {
        console.error(error);
        note.textContent = "No se pudo cargar esta capa. Vuelve a activarla para intentar de nuevo.";
      }).finally(() => { pending = null; });
      return pending;
    }
    checkbox.addEventListener("change", () => { if (checkbox.checked) loadLayer(); });
    zoom.addEventListener("click", async () => {
      checkbox.checked = true;
      if (!map.hasLayer(group)) group.addTo(map);
      await loadLayer();
      if (entry.bounds) map.fitBounds(entry.bounds, {padding: [24, 30]});
      if (window.innerWidth <= 700) setPanel(false);
    });
    opacity.addEventListener("input", applyOpacity);
  }

  status.hidden = true;
  exportButton.disabled = false;
  exportButton.addEventListener("click", () => downloadMap(map));
  document.documentElement.dataset.mapReady = "true";
}

start().catch(error => {
  console.error(error);
  status.textContent = "No se pudo cargar el mapa. Abre el visor desde su servidor local o usa la versión HTML autónoma.";
});







function renderSvg(element) {
  return new Promise((resolve, reject) => {
    const copy = element.cloneNode(true);
    copy.removeAttribute("style");
    copy.removeAttribute("class");
    const svg = new XMLSerializer().serializeToString(copy);
    const url = URL.createObjectURL(new Blob([svg], {type: "image/svg+xml;charset=utf-8"}));
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo dibujar una capa vectorial.")); };
    image.src = url;
  });
}

function wrappedLines(context, text, width) {
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? line + " " + word : word;
    if (line && context.measureText(next).width > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

async function downloadMap(map) {
  exportButton.disabled = true;
  status.textContent = "Preparando PNG…";
  status.hidden = false;
  try {
    const container = map.getContainer();
    if (container.dataset.satelliteLoading === "true") {
      status.textContent = "La imagen satelital sigue cargando. Espera unos segundos y vuelve a descargar.";
      return;
    }
    const viewport = container.getBoundingClientRect();
    const width = Math.round(viewport.width);
    const height = Math.round(viewport.height);
    const center = map.getCenter();
    const zoom = map.getZoom();
    const time = new Intl.DateTimeFormat("es-EC", {
      dateStyle: "medium", timeStyle: "short", timeZone: "Pacific/Galapagos"
    }).format(new Date());
    const names = [...document.querySelectorAll(".panel input[type=checkbox]:checked")]
      .map(input => input.closest("label").querySelector("span").textContent.trim());
    const combined = document.querySelector("#base-reference").checked &&
      document.querySelector("#base-project").checked;
    const opacity = document.querySelector("#base-opacity").value;
    const scale = container.querySelector(".leaflet-control-scale-line")?.textContent;
    const heading = document.querySelector("h1").textContent;
    const details = [
      "Santa Cruz, Galápagos · Vista del " + time + " (hora de Galápagos)",
      "Centro (lat., lon.) " + center.lat.toFixed(5) + ", " + center.lng.toFixed(5) +
        " · Zoom " + zoom.toFixed(2) + (scale ? " · Escala gráfica " + scale : ""),
      "Capas activas · " + (names.join(", ") || "Ninguna") +
        (combined ? " · Opacidad de la cartografía del proyecto " + opacity + " %" : ""),
      "Fuentes · © OpenStreetMap contributors, Copernicus, SNGR, Instituto Geográfico Militar, Fundación Charles Darwin, Diango y plano DWG.",
      "Escorrentías modeladas y cruces cartográficos.",
      reportCredit
    ];
    if (document.getElementById("sngr").checked || document.getElementById("sitrep06").checked) {
      details.splice(details.length - 1, 0,
        "Polígonos SNGR · Rojo: La Cascada · Naranja: Los Arrayanes · Verde: La Unión. Colores por sector afectado.");
    }
    if (document.getElementById("satellite-basemap").checked) {
      details.splice(details.length - 1, 0,
        "Imagen satelital · EOxCloudless 2025 by EOX IT Services GmbH; contains modified Copernicus Sentinel data 2025. CC BY-NC-SA 4.0 · https://maps.eox.at/ · Opacidad " +
        document.getElementById("satellite-opacity").value + " %");
    }
    const panes = Object.entries(map.getPanes())
      .filter(([name]) => name !== "mapPane" && name !== "popupPane" && name !== "tooltipPane")
      .map(([, pane]) => pane)
      .sort((a, b) => Number(getComputedStyle(a).zIndex) - Number(getComputedStyle(b).zIndex));
    const draws = [];
    for (const pane of panes) {
      const alpha = Number(getComputedStyle(pane).opacity);
      for (const element of pane.querySelectorAll("svg, img.leaflet-image-layer, img.leaflet-tile, .map-label span")) {
        const bounds = element.getBoundingClientRect();
        if (!bounds.width || !bounds.height || bounds.bottom < viewport.top || bounds.top > viewport.bottom ||
            bounds.right < viewport.left || bounds.left > viewport.right) continue;
        const style = getComputedStyle(element);
        const fade = Number(style.opacity) * alpha;
        const rect = [bounds.left - viewport.left, bounds.top - viewport.top, bounds.width, bounds.height];
        if (element instanceof SVGElement) draws.push({image: renderSvg(element), rect, fade});
        else if (element instanceof HTMLImageElement && element.complete && element.naturalWidth) {
          draws.push({image: element, rect, fade});
        } else if (element.matches(".map-label span")) {
          const parent = getComputedStyle(element.parentElement);
          draws.push({text: element.textContent, font: parent.fontWeight + " " + parent.fontSize + " Arial", rect, fade});
        }
      }
    }

    const canvas = document.createElement("canvas");
    const measure = canvas.getContext("2d");
    const gutter = 16;
    const textWidth = width - 2 * gutter;
    measure.font = "bold 17px Arial";
    const titleLines = wrappedLines(measure, heading, textWidth);
    measure.font = "12px Arial";
    const body = details.map(line => wrappedLines(measure, line, textWidth));
    const footer = 24 + titleLines.length * 21 + body.reduce((sum, lines) => sum + lines.length * 17, 0);
    canvas.width = width * 2;
    canvas.height = (height + footer) * 2;
    const ctx = canvas.getContext("2d");
    ctx.scale(2, 2);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.clip();
    ctx.fillStyle = getComputedStyle(container).backgroundColor;
    ctx.fillRect(0, 0, width, height);
    for (const [index, image] of (await Promise.all(draws.map(item => item.image))).entries()) {
      const item = draws[index];
      ctx.globalAlpha = item.fade;
      if (image) ctx.drawImage(image, ...item.rect);
      if (item.text) {
        ctx.font = item.font;
        ctx.textBaseline = "top";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "white";
        ctx.fillStyle = "#263d38";
        ctx.strokeText(item.text, ...item.rect.slice(0, 2));
        ctx.fillText(item.text, ...item.rect.slice(0, 2));
      }
    }
    ctx.restore();
    if (scale) {
      const pixels = container.querySelector(".leaflet-control-scale-line").getBoundingClientRect().width;
      ctx.fillStyle = "#fff";
      ctx.fillRect(gutter, height - 36, pixels + 10, 24);
      ctx.font = "11px Arial";
      ctx.fillStyle = "#1c3432";
      ctx.fillText(scale, gutter + 5, height - 22);
      ctx.fillRect(gutter + 5, height - 18, pixels, 2);
    }
    ctx.fillStyle = "#fffefa";
    ctx.fillRect(0, height, width, footer);
    ctx.fillStyle = "#1c5048";
    ctx.fillRect(0, height, width, 2);
    let baseline = height + 22;
    ctx.fillStyle = "#1c3432";
    ctx.font = "bold 17px Arial";
    for (const line of titleLines) {
      ctx.fillText(line, gutter, baseline);
      baseline += 21;
    }
    for (const [index, group] of body.entries()) {
      ctx.font = index === body.length - 1 ? "bold 12px Arial" : "12px Arial";
      for (const line of group) {
        ctx.fillText(line, gutter, baseline);
        baseline += 17;
      }
    }
    const png = await new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("No se pudo generar el PNG.")), "image/png");
    });
    const url = URL.createObjectURL(png);
    const download = document.createElement("a");
    download.href = url;
    download.download = "Santa Cruz - vista del mapa.png";
    download.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    status.hidden = true;
  } catch (error) {
    console.error(error);
    status.textContent = "No se pudo exportar la vista. Si usas teselas en línea, cambia al fondo incluido y vuelve a intentar.";
  } finally {
    exportButton.disabled = false;
  }
}

