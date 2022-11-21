import { createInterface } from 'readline';
import { URL } from 'url';
import request from 'request';
import { response } from 'express';

const readline = createInterface({
    input: process.stdin,
    output: process.stdout
});

const POSTCODES_BASE_URL = 'https://api.postcodes.io';
const TFL_BASE_URL = 'https://api.tfl.gov.uk';

export default class ConsoleRunner {
  promptForPostcode(callback) {
    readline.question("\nEnter your postcode: ", function (postcode) {
      readline.close();
      callback(postcode);
    });
  }

  displayStopPoints(stopPoints) {
    if (stopPoints.length === 0) {
        throw new Error("There are no stops near you")
    }
    stopPoints.forEach((point) => {
      console.log(point.commonName);
    });
  }

  buildUrl(url, endpoint, parameters) {
    const requestUrl = new URL(endpoint, url);
    parameters.forEach((param) =>
      requestUrl.searchParams.append(param.name, param.value)
    );
    return requestUrl.href;
  }

  makeGetRequest(baseUrl, endpoint, parameters) {
    const url = this.buildUrl(baseUrl, endpoint, parameters);

    return new Promise(function (resolve, reject) {
      request.get(url, (err, response, body) => {
        if (err) {
          reject(err);
        } else if (response.statusCode !== 200) {
          reject(response.statusCode);
        } else {
          resolve(body);
        }
      });
    });
  }

  async getLocationForPostCode(postcode) {
    return this.makeGetRequest(POSTCODES_BASE_URL, `postcodes/${postcode}`, [])
      .then(function success(data) {
        const jsonBody = JSON.parse(data);
        return {
          latitude: jsonBody.result.latitude,
          longitude: jsonBody.result.longitude,
        };
      })
      .catch((error) => {
        throw new Error("couldnt get location")
      });
  }

  async getNearestStopPoints(latitude, longitude, count) {
    return this.makeGetRequest(TFL_BASE_URL, `StopPoint`, [
      { name: "stopTypes", value: "NaptanPublicBusCoachTram" },
      { name: "lat", value: latitude },
      { name: "lon", value: longitude },
      { name: "radius", value: 1000 },
      { name: "app_id", value: "" /* Enter your app id here */ },
      { name: "app_key", value: "" /* Enter your app key here */ },
    ])
      .then(function success(data) {
        return JSON.parse(data)
          .stopPoints.map(function (entity) {
            return { naptanId: entity.naptanId, commonName: entity.commonName };
          })
          .slice(0, count);
      })
      .catch((error) => {
        throw new Error("couldnt get stop points")
      });
  }

  async run() {
    const that = this;
    return that.promptForPostcode(async (postcode) => {
      postcode = postcode.replace(/\s/g, "");
      try {
        const postCodes = await that.getLocationForPostCode(postcode);
        const stops = await that.getNearestStopPoints(postCodes.latitude, postCodes.longitude, 5);
        return that.displayStopPoints(stops);
      } catch(error) {
        console.log(error.message);
      }
    });
  }
}
