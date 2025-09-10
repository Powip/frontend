import axios from "axios";
import { API } from "@/lib/api";

// Categorías
export const getCategories = async () => {
  try {
    const { data } = await axios.get(`${API.productos}/categories`);
    return data;
  } catch (error) {
    throw new Error("Error al obtener categorías");
  }
};

// SubCategorías
export const getSubCategories = async () => {
  try {
    const { data } = await axios.get(`${API.productos}/subcategories`);
    return data;
  } catch (error) {
    throw new Error("Error al obtener subcategorías");
  }
};

// Productos
export const getProducts = async () => {
  try {
    const {data} = await axios.get(`${API.productos}/products`);
    return data
  } catch (error) {
    throw new Error("Error al obtener productos");
  }
};

// Marcas
export const getBrands = async () => {
  try {
    const { data } = await axios.get(`${API.productos}/brand`);
    return data;
  } catch (error) {
    throw new Error("Error al obtener marcas");
  }
};

//Attributes
export const getAttributes = async () => {
  try {
    const { data } = await axios.get(`${API.productos}/attributes`);
    return data;
  } catch (error) {
    throw new Error("Error al obtener attributes");
  }
};

//AttributeTypes
export const getAttributeTypes = async () => {
  try {
    const { data } = await axios.get(`${API.productos}/attributeTypes`);
    return data;
  } catch (error) {
    throw new Error("Error al obtener tipos de atributo");
  }
};

// Proveedores
export const getCompanies = async () => {
  try {
    const { data } = await axios.get(`${API.productos}/Company-categories`);
    return data;
  } catch (error) {
    throw new Error("Error al obtener proveedores");
  }
};
