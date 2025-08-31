declare module 'react-select-country-list' {
  interface CountryOption {
    value: string;
    label: string;
  }

  interface CountryList {
    getData(): CountryOption[];
  }

  function countryList(): CountryList;
  export default countryList;
}
