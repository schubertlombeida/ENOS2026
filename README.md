# Visor de escorrentías de Santa Cruz

Análisis preparado por Schubert Lombaida.

## Vista previa

Descomprime el ZIP y abre index.html directamente en el navegador. Para probarlo por HTTP, abre una terminal en esa carpeta y ejecuta:

    python -m http.server 8765

Abre http://localhost:8765. La versión HTML autónoma se puede abrir directamente. Si quieres usar sus enlaces de descarga, consérvala junto al PDF final y al ZIP de datos.

El botón Descargar PNG guarda la vista actual a 2×, con la escala y un pie que registra el encuadre, las capas, las fuentes y el crédito.
 
## GitHub Pages

1. Crea un repositorio público y sube el contenido del ZIP a la raíz de la rama main.
2. En Settings > Pages selecciona Deploy from a branch, rama main y carpeta / (root).
3. Abre la URL que indique GitHub Pages. Las rutas relativas permiten publicarlo bajo /nombre-del-repositorio/.

## Vercel

Importa el repositorio. Selecciona Framework Preset: Other y publica la raíz del repositorio como salida estática. El visor no necesita dependencias de compilación ni variables de entorno.

## Datos y actualización

Las capas se leen de data/ en GeoJSON en WGS 84. El fondo local de calles, costa y uso de suelo usa datos © OpenStreetMap contributors bajo ODbL (https://www.openstreetmap.org/copyright). La cartografía del proyecto y la referencia vectorial de OpenStreetMap se pueden activar simultáneamente y comparar con el control de opacidad. Las teselas en línea son opcionales y solo se habilitan al servir el visor por HTTP(S). Si el servidor rechaza una tesela, sigue disponible la referencia vectorial incluida. Leaflet 1.9.4 está incluido con su licencia.

Los GeoJSON de escorrentía provienen del paquete cartográfico final. Las rutas son modeladas con Copernicus GLO-30 (30 m); los cruces son intersecciones cartográficas. El detalle circular del DWG se sirve como una imagen transparente, ajustada a su georreferenciación referencial. El eje del DWG está disponible por separado en GeoJSON.

Revisa el alcance de publicación del PDF, el paquete de datos y la imagen del DWG antes de subir el repositorio, porque los archivos de un repositorio público son accesibles por URL. Los archivos y las rutas de descarga están en descargas/.



## Capas complementarias

- Relieve y acumulación derivada de Copernicus GLO-30 (área aportante, no caudal).
- SNGR, SitRep 07, mapa de la página 6, corte 4 de noviembre de 2026. Se digitalizaron aproximadamente tres sectores, el eje de la cañada y los cruces representados. Las clases de profundidad se consultan en el PDF enlazado. La ortofoto de dron citada en el informe no se obtuvo como archivo independiente.
- Vías y cursos de agua del WFS Galápagos 1:25.000 del Instituto Geográfico Militar: https://www.geoportaligm.gob.ec/galapagos25/wfs . La consulta de alcantarillado devolvió cero registros para el corredor. El WMS general y los servicios de ortofoto de 2020 a 2024 devolvieron excepciones.
- Sentinel-2 L2A antes y después. Las fechas, IDs de escenas y fuente se registran en data/satellite.json. Ambos recortes tienen nubes; no se ha inferido una huella de inundación a partir de ellos.
- Lluvia agregada a mes a partir de las estaciones Bellavista y Puerto Ayora. Fuente: Galapagos Climatology Database, dataZone, Fundación Charles Darwin (https://datazone.darwinfoundation.org/es/clima), licencia CC BY-NC-SA 4.0 (https://creativecommons.org/licenses/by-nc-sa/4.0/). Cada mes conserva el número de días registrados. El gráfico muestra valores solo para meses completos.



## SitRep 06 vectorial
Se añadió sitrep06_vector.geojson con 28 elementos reconstruidos desde el JPEG de la última página, usando la cuadrícula UTM impresa. Incluye tres sectores, cañada, seis trazados de drenaje y dieciocho cruces. El contorno de inundación y las clases de profundidad requieren geometrías originales. El visor permite activar esta reconstrucción y ampliar su encuadre.

## Mapas Puerto Ayora · archivos KMZ incorporados

Se incorporaron nueve KMZ de la carpeta proporcionada. El catálogo data/kml-catalog.json documenta cantidades, extensión, reparaciones y nombres de origen. Las geometrías son WGS 84, se seleccionan elementos que intersectan el sur de Santa Cruz y se simplifican a aproximadamente 0,13 m, conservando topología. Las cotas constantes de las curvas se conservan en cota_m. CURVAS-PROFUNDIDAD contiene curvas batimétricas; su datum vertical no está especificado.

Las capas catastrales muestran geometría y atributos geográficos. Los nombres de propietarios, cédulas y avalúos de los KMZ originales no se incluyen en la aplicación. Los archivos originales permanecen en la carpeta de origen.

El centro de reciclaje contiene una pirámide de 500 imágenes. Se generó un mosaico de 2400×2400 píxeles georreferenciado y reproyectado a Web Mercator para el navegador. Las coordenadas del KMZ se respetan. La fecha de captura no está especificada.

Miramar se rotuló con los polígonos rurales cuyo sector es MIRAMAR. Divino Niño usa el polígono del KMZ homónimo. El sector Tomás de Berlanga usa los predios con variantes de ese nombre. Las referencias de sector son representativas y no constituyen delimitaciones oficiales de barrios.

Las capas se activan en Escorrentías, Catastros y predios, Relieve y batimetría, Sectores e imágenes y Riesgos y referencias. Ver zona centra el mapa en cada conjunto. El control de opacidad sirve para comparar con las escorrentías. La reconstrucción del mapa de riesgos SNGR está en ese mismo grupo.

Se retiró la capa Predios urbanos 2019 por duplicación del catastro más reciente. El archivo catastral conservado lleva 2021 en su nombre de origen.


## Fondo fotográfico satelital

EOxCloudless 2025 / Sentinel-2 está disponible en Fondos del mapa. Se descarga únicamente la vista actual del servicio WMTS de EOX. No se distribuyen teselas en el ZIP. Resolución nativa aproximada de 10 m; se amplía en zooms mayores sin aumentar el detalle original. Requiere internet, funciona desde el HTML autónomo si el navegador permite CORS, y se desactiva si el servidor falla. Incluye transparencia y atribución en pantalla y al descargar PNG.

Atribución: EOxCloudless 2025 by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2025). CC BY-NC-SA 4.0.
https://maps.eox.at/
https://cloudless.eox.at/pricing
https://creativecommons.org/licenses/by-nc-sa/4.0/
La edición es un mosaico temporal, no una observación del día. El uso comercial de esta edición requiere licencia del proveedor.

