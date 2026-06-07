import axios from "axios";
import { IMAGE_SEARCH_COUNT } from "@constants/crawler";

const crawlerURL = process.env.REACT_APP_CRAWLER_URL;
export const translateEnToVI = (term) => {
  return axios.post(`${crawlerURL}translate/`, { text: term });
};
export const getImagesURL = (query, count = IMAGE_SEARCH_COUNT) => {
  return axios.post(`${crawlerURL}images/`, { query, count });
};
