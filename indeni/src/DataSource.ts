// @ts-nocheck
import { getBackendSrv, getTemplateSrv } from '@grafana/runtime';
import { DataQueryRequest, DataQueryResponse, DataSourceApi, DataSourceInstanceSettings } from '@grafana/data';

import { MyQuery, MyDataSourceOptions } from './types';

export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
  url: string;
  headers: any;
  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);

    this.url = instanceSettings.url || '';
    this.headers = { 'Content-Type': 'application/json' };
    if (typeof instanceSettings.basicAuth === 'string' && instanceSettings.basicAuth.length > 0) {
      this.headers['Authorization'] = instanceSettings.basicAuth;
    }
  }

  async query(options: DataQueryRequest<MyQuery>): Promise<DataQueryResponse> {
    if (options.targets.length === 0) {
      return Promise.resolve({ data: [] });
    }

    const start = new Date(options.range.from).getTime();
    const end = new Date(options.range.to).getTime();

    const sentRequests = options.targets.map(target => {
      const { device, metric, data } = target;
      let filters = '';
      if (data) {
        try {
          const obj = JSON.parse(data);
          filters = Object.keys(obj)
            .map(key => `;${key}=="${obj[key]}"`)
            .join('');
        } catch (e) {}
      }
      return this.doRequest({
        url: `${this.url}/api/v2/metrics?query=(device-id=="${device}";live-config=="true";im.name=="${metric}"${filters})&start=${start}&end=${end}`,
        method: 'GET',
      });
    });
    return Promise.all(sentRequests).then(responses => {
      const finalResponse = [];
      responses.map((response, i) => {
        response.data
          .filter(item => item.metric_type !== 'complex_metric')
          .forEach(item => {
            const names = (item.tags['im.identity-tags'] || '').split('|');
            finalResponse.push({
              target: names.map(name => item.tags[name]).join(' ') || item.tags['display-name'],
              datapoints: item.points.map((point, pi) => [point, item.start + Number(item.step) * pi]),
            });
          });
      });
      return { data: finalResponse };
    });
  }

  async testDatasource() {
    return this.doRequest({
      url: `${this.url}/api/v2/metrics?query=(device-id=="7ebbeeb4-e60d-47dd-a0c0-7b60354cf9de")`,
      method: 'GET',
    }).then((response: { status: number; message: any }) => {
      if (response.status === 200) {
        return {
          status: 'success',
          message: 'Data source is working',
          title: 'Success',
        };
      }

      return {
        status: 'error',
        message: `Data source is not working: ${response.message}`,
        title: 'Error',
      };
    });
  }

  async getMetrics(deviceId: string): Promise<Array<{}>> {
    return this.doRequest({
      url: `${this.url}/api/v2/metrics?query=(device-id=="${deviceId}";live-config=="true")`,
      method: 'GET',
    }).then((response: { status: number; data: any; message: any }) => {
      if (response.status === 200) {
        const names = {};
        return response.data
          .filter(item => {
            if (
              item.metric_type === 'complex_metric' ||
              names[item.tags['im.name']] ||
              item.tags['live-config'] !== 'true'
            ) {
              return false;
            }
            names[item.tags['im.name']] = 1;
            return true;
          })
          .map((metric: { tags: { [x: string]: any } }) => ({
            text: metric.tags['im.name'],
            value: metric.tags['im.name'],
          }))
          .sort((a, b) => {
            if (a.text < b.text) {
              return -1;
            }
            if (a.text > b.text) {
              return 1;
            }
            return 0;
          });
      }

      return {
        status: 'error',
        message: `Data source is not working: ${response.message}`,
        title: 'Error',
      };
    });
  }

  async getDevices(): Promise<Array<{}>> {
    return this.doRequest({
      url: `${this.url}/api/v2/devices`,
      method: 'GET',
    }).then(
      (response: {
        status: number;
        data: {
          map: (arg0: (device: any) => { text: any; value: any }) => void;
        };
        message: any;
      }) => {
        if (response.status === 200) {
          return response.data
            .map(device => ({
              text: device.name,
              value: device.id,
            }))
            .sort((a, b) => {
              if (a.text < b.text) {
                return -1;
              }
              if (a.text > b.text) {
                return 1;
              }
              return 0;
            });
        }

        return {
          status: 'error',
          message: `Data source is not working: ${response.message}`,
          title: 'Error',
        };
      }
    );
  }

  doRequest(options: any) {
    options.withCredentials = true;
    options.headers = this.headers;

    return getBackendSrv().datasourceRequest(options);
  }
}
