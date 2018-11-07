import React from 'react';
import ReactDOM from 'react-dom';
import styles from './style.css';

class Map extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      error: null,
      isLoaded: false,
      items: [],
      poly: [],
      date: '2017-09',
      initialLat: 51.5203,
      initialLng: -0.1202
    }

    this.markers = [];

    this.initializeMap = this.initializeMap.bind(this);
    this.makeBounds = this.makeBounds.bind(this);
    this.getCrimeData = this.getCrimeData.bind(this);
    this.getRectangleCoordinates = this.getRectangleCoordinates.bind(this);
    this.renderCrimeData = this.renderCrimeData.bind(this);
    this.clearMapMarkers = this.clearMapMarkers.bind(this);
    this.initSearchBox = this.initSearchBox.bind(this);

    String.prototype.formatTitle = function() {
      const removeDash = this.replace(/-/g,' ');
      return removeDash.charAt(0).toUpperCase() + removeDash.slice(1);
    };
  }

  componentDidMount() {
    setTimeout(() => {
      this.initializeMap();
    }, 0);
  }

  componentDidUpdate() {
    this.renderCrimeData();
  }

  initializeMap() {
    const { initialLat, initialLng } = this.state;

    // center map with initial location
    const nw = new google.maps.LatLng(initialLat, initialLng),
          mapOptions = {
            center: nw,
            zoom: 15
          },
          bounds = this.makeBounds(nw, 1000, 1000);

    this.map = new google.maps.Map(document.getElementById('map'), mapOptions);
    this.rectangle = new google.maps.Rectangle({
      bounds: bounds,
      draggable: true
    });

    this.rectangle.setMap(this.map);
    this.rectangle.addListener('dragend', this.getRectangleCoordinates);

    this.infoWindow = new google.maps.InfoWindow();

    // generate initial map crime data
    this.getRectangleCoordinates();

    // init search input
    this.initSearchBox();
  }

  getRectangleCoordinates() {
    // get coordinates for the four corners of the rectangle
    const rectangleBounds = this.rectangle.getBounds(),
          ne = rectangleBounds.getNorthEast(),
          sw = rectangleBounds.getSouthWest(),
          nw = new google.maps.LatLng(ne.lat(), sw.lng()),
          se = new google.maps.LatLng(sw.lat(), ne.lng()),
          cornersArr = [],
          polyArr = [];

    cornersArr.push(nw, ne, se, sw);

    // build format AsPI expects for poly
    cornersArr.forEach((corner) => {
        const coordinates = corner.lat() + ',' + corner.lng();
        polyArr.push(coordinates);
    });

    const poly = polyArr.join(':');

    this.setState({
      poly
    });

    this.getCrimeData();
  }

  makeBounds(center, width, height) {
    const north = this.computeOffset(center, height / 2, 0),
          south = this.computeOffset(center, height / 2, 180),
          northEast = this.computeOffset(north, width / 2, 90),
          southWest = this.computeOffset(south, width / 2, -90);

    return new google.maps.LatLngBounds(southWest, northEast);
  }

  computeOffset(fromLatLng, distance, heading) {
    return google.maps.geometry.spherical.computeOffset(fromLatLng, distance, heading);
  }

  getCrimeData() {
    this.setState({
      isLoaded: false
    })
    const { poly, date } = this.state,
          params = {
            poly,
            date
          },
          esc = encodeURIComponent,
          query = Object.keys(params)
            .map(k => `${esc(k)}=${esc(params[k])}`)
            .join('&');

    fetch(`https://data.police.uk/api/crimes-street/all-crime?${query}`)
      .then(res => res.json())
      .then(
        (result) => {
          this.setState({
            isLoaded: true,
            items: result
          })
        },
        (error) => {
          this.setState({
            isLoaded: true,
            error
          });
        }
      )
  }

  renderCrimeData() {
    // clear previous markers
    this.clearMapMarkers();

    const { items } = this.state;

    items.forEach((crime) => {
      const { location: { latitude, longitude }, category } = crime,
            pos = new google.maps.LatLng(
              latitude,
              longitude
            ),
            marker = new google.maps.Marker({
                position: pos,
                map: this.map,
                title: category.formatTitle()
            });

      this.markers.push(marker);

      marker.addListener('click', this.showInfoWindow.bind(this, marker, crime));
    });
  }

  clearMapMarkers() {
    this.markers.forEach((marker) => {
      marker.setMap(null);
    });
    this.markers = [];
  }

  showInfoWindow(marker, crime) {
    const { category, month, location: { street: { name } } } = crime,
          content = category.formatTitle() + '<br />' +
                    month + ' ' +
                    name;

    this.infoWindow.setContent(content);
    this.infoWindow.open(this.map, marker);
  }

  initSearchBox() {
    // Create the search box and link it to the UI element.
    const input = document.getElementById('pac-input'),
          autocomplete = new google.maps.places.Autocomplete(input);
    this.map.controls[google.maps.ControlPosition.TOP_LEFT].push(input);

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (place.length === 0) return;

      // If the place has a geometry, then show it on a map.
      if (place.geometry) {
        place.geometry.viewport ? this.map.fitBounds(place.geometry.viewport) :
                                  this.map.setCenter(place.geometry.location);

        const nw = new google.maps.LatLng(
                      place.geometry.location.lat(),
                      place.geometry.location.lng()
                  ),
              bounds = this.makeBounds(nw, 1000, 1000);

        this.rectangle.setBounds(bounds);

        this.map.setZoom(15);

        // render markers
        this.getRectangleCoordinates();
      } else {
        this.setState({
          isLoaded: true,
          error: { message: 'There was a problem with the search.' }
        });
      }
    });
  }

  render() {
    const { error, isLoaded } = this.state;

    return (
      <div className={`${isLoaded ? '' : styles.loading}`}>
        <input
          id="pac-input"
          className="controls"
          type="text"
          placeholder="Search Box"
        />
        <div id="map" className={styles.map} />
        {error && (
          <div className={`${styles['text-center']} ${styles.error}`}>
            <p>There was an error: {error.message}</p>
          </div>
        )}
      </div>
    );
  }
}

class Page extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <div id="content" className={styles.content}>
          <div className={styles['text-center']}>
              <h1>Mihai's London Crime Map</h1>
          </div>
          <div>
            <Map />
            <div className={styles['text-center']}>
              <p>Drag selection across the map to view crimes in the area.</p>
              <p>Click on a marker to view more details about the crime.</p>
            </div>
          </div>
      </div>
    );
  }
}

ReactDOM.render(
  <Page />,
  document.getElementById('root')
);
