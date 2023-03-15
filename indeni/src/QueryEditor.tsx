// @ts-nocheck
import { DataSource } from './DataSource';
import { MyDataSourceOptions, MyQuery } from './types';
import { AsyncSelect, CodeEditor, Label } from '@grafana/ui';

import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { find } from 'lodash';

import React, { ComponentType } from 'react';

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

export const QueryEditor: ComponentType<Props> = ({ datasource, onChange, onRunQuery, query }) => {
  const [device, setDevice] = React.useState<SelectableValue<string>>();
  const [metric, setMetric] = React.useState<SelectableValue<string>>();
  const [data, setData] = React.useState(query.data ?? '');
  const [deviceUpdated, setDeviceUpdated] = React.useState(false);

  React.useEffect(() => {
    if (device?.value === undefined) {
      return;
    }

    if (metric?.value === undefined) {
      return;
    }

    onChange({
      ...query,
      data: data,
      metric: metric?.value,
      device: device?.value,
    });

    onRunQuery();
  }, [data, device, metric]);

  React.useEffect(() => {
    if (deviceUpdated) {
      setDeviceUpdated(false);
    }
  }, [deviceUpdated, setDeviceUpdated]);

  const loadMetrics = (searchQuery: any) => {
    if (!device) {
      return;
    }
    return datasource.getMetrics(device.value || '').then(
      result => {
        const metrics = result.map((value: any) => ({
          label: value.text,
          value: value.value,
        }));

        setMetric(find(metrics, metric => metric.value === query.metric));

        return metrics.length ? metrics : [{ label: 'no metrics for this device', value: undefined }];
      },
      response => {
        throw new Error(response.statusText);
      }
    );
  };

  const loadDevices = (searchQuery: any): Promise<Array<SelectableValue<any>>> => {
    return datasource.getDevices().then(
      result => {
        const devices = result.map((value: any) => ({
          label: value.text,
          value: value.value,
        }));

        setDevice(find(devices, device => device.value === query.device));

        return devices;
      },
      response => {
        throw new Error(response.statusText);
      }
    );
  };

  return (
    <>
      <div className="gf-form-inline">
        <div className="gf-form">
          <AsyncSelect
            prefix="Device: "
            loadOptions={loadDevices}
            defaultOptions
            placeholder="Select device"
            allowCustomValue
            value={device}
            onChange={v => {
              setDevice(v);
              setDeviceUpdated(true);
            }}
          />
        </div>

        <div className="gf-form">
          {device && !deviceUpdated && (
            <AsyncSelect
              prefix="Metric: "
              loadOptions={loadMetrics}
              defaultOptions
              placeholder="Select metric"
              allowCustomValue
              value={metric}
              onChange={v => {
                setMetric(v);
              }}
            />
          )}
        </div>
      </div>
      <div className="gf-form gf-form--alt">
        <div className="gf-form-label">
          <Label>Additional JSON Data</Label>
        </div>
        <div className="gf-form">
          <CodeEditor
            width="500px"
            height="100px"
            language="json"
            showLineNumbers={true}
            showMiniMap={data.length > 100}
            value={data}
            onBlur={(value: any) => setData(value)}
          />
        </div>
      </div>
    </>
  );
};
