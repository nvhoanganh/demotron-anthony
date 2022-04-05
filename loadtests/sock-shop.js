import http from 'k6/http';
import { sleep, check } from 'k6';
import { Counter } from 'k6/metrics';

// A simple counter for http requests
export const requests = new Counter('http_reqs');

// you can specify stages of your test (ramp up/down patterns) through the options object
// target is the number of VUs you are aiming for

export const options = {
  // stages: [
  //   { target: 5, duration: '3m' },
  // ],
  stages: [
    { target: 1, duration: '2m' },
    { target: 100, duration: '20m' },
    { target: 10, duration: '1m' },
    { target: 2, duration: '1m' },
    { target: 0, duration: '1m' },
  ],
  thresholds: {
    requests: ['count < 100'],
  },
};

export function setup() {
  const BASE_URL = `http://${__ENV.PUBLIC_IP}/`;
  console.log('register user: "user"')
  let request = http.post(`${BASE_URL}register`, JSON.stringify({
    "username": "user", "password": "password", "email": "", "firstName": "", "lastName": ""
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export default function () {
  // browse the app
  console.log('start browsing the app')
  const BASE_URL = `http://${__ENV.PUBLIC_IP}/`;
  const res = http.get(`${BASE_URL}category.html`);

  sleep(1);

  const checkRes = check(res, {
    'category.html status is 200': (r) => r.status === 200,
  });

  let requests = ['catalogue/size?tags=', 'tags', 'catalogue?page=1&size=6&tags=', 'cart', 'cards', 'basket.html'];
  requests.forEach(url => {
    const dest = `${BASE_URL}${url}`
    const reqr = http.get(dest);
    const checkresult = check(reqr, {
      'general browser returns 200': (r) => r.status === 200,
    });
  });

  sleep(1);

  console.log('loging now')

  // login using user "user" and passwor "password"
  const loginR = http.get(`${BASE_URL}login`, {
    headers: { 'Authorization': 'Basic dXNlcjpwYXNzd29yZA==' }
  });

  const checkLoginResult = check(loginR, {
    'login status is 200': (r) => r.status === 200,
  });

  console.log('user is now logged in, checking to see items in the basket')

  sleep(1);

  // see pages which can only be seen by logged in user
  requests = ['basket.html', 'cart', 'card', 'address', 'orders'];
  requests.forEach(url => {
    const dest = `${BASE_URL}${url}`
    const reqr = http.get(dest);
    const checkresult = check(reqr, {
      'basket.html : status is 200': (r) => r.status === 200,
    });
  });


  console.log('Adding item to cart')
  // add item into the cart
  let request = http.post(`${BASE_URL}cart`, JSON.stringify({
    id: '3395a43e-2d88-40de-b95f-e00e1502085b'
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(request, {
    'add item to cart: status is 201': (r) => r.status === 201,
  });

  console.log('view cart again')

  request = http.get(`${BASE_URL}cart`);

  check(request, {
    'view cart: status is 200': (r) => r.status === 200,
    'cart is not empty array': (r) => JSON.parse(r.body).length > 0,
  });

  console.log('update number of items in the cart to 20, this should generate error')

  request = http.post(`${BASE_URL}cart/update`, JSON.stringify({
    id: "3395a43e-2d88-40de-b95f-e00e1502085b",
    quantity: "21"
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(request, {
    'update cart to more than 20: status is 500': (r) => r.status === 500
  });

  console.log('update number of items in the cart to 1, this should be ok')

  request = http.post(`${BASE_URL}cart/update`, JSON.stringify({
    id: "3395a43e-2d88-40de-b95f-e00e1502085b",
    quantity: "1"
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(request, {
    'update cart to 1, status is 202': (r) => r.status === 202
  });
}
