import axios from "axios";

const crawlerURL = process.env.REACT_APP_CRAWLER_URL;
export const translateEnToVI = (term) => {
  return axios.post(`${crawlerURL}translate/`, { text: term });
};
export const getImagesURL = (query) => {
  return axios.post(`${crawlerURL}images/`, { query });
};