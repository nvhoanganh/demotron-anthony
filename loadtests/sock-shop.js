import http from 'k6/http';
import { sleep, check } from 'k6';
import { Counter } from 'k6/metrics';

// A simple counter for http requests
export const requests = new Counter('http_reqs');

// you can specify stages of your test (ramp up/down patterns) through the options object
// target is the number of VUs you are aiming for

export const options = {
  stages: [
    { target: 20, duration: '1m' },
    { target: 15, duration: '1m' },
    { target: 0, duration: '1m' },
  ],
  thresholds: {
    requests: ['count < 100'],
  },
};

export default function () {
  // our HTTP request, note that we are saving the response to res, which can be accessed later
  const BASE_URL = `http://${__ENV.PUBLIC_IP}/`;
  const res = http.get(`${BASE_URL}category.html`);

  sleep(1);

  const checkRes = check(res, {
    'status is 200': (r) => r.status === 200,
  });

  let requests = ['catalogue/size?tags=', 'tags', 'catalogue?page=1&size=6&tags=', 'cart', 'card', 'address', 'basket.html'];
  requests.forEach(url => {
    const dest = `${BASE_URL}${url}`
    const reqr = http.get(dest);
    const checkresult = check(reqr, {
      'status is 200': (r) => r.status === 200,
    });
  });

  sleep(1);

  requests = ['basket.html', 'cart','card','address'];
  requests.forEach(url => {
    const dest = `${BASE_URL}${url}`
    const reqr = http.get(dest);
    const checkresult = check(reqr, {
      'status is 200': (r) => r.status === 200,
    });
  });
}
