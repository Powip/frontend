import { useEffect, useState } from "react";
import { useOlvaUbigeoTree } from "@/features/olva/olva-catalog/hooks/use-olva-ubigeo-tree";
import { findOlvaDivisionName } from "../utils/find-olva-division-name";
import type { OlvaAddressGuess } from "./use-olva-agency-cascade";

interface UseOlvaUbigeoCascadeParams {
  guess: OlvaAddressGuess;
  /** The ubigeo the form holds now ("" while no district is chosen). */
  ubigeoCode: string;
  /** Writes the ubigeo into the form: the code of the chosen district, or "" when it is cleared. */
  onUbigeoChange: (ubigeoCode: string) => void;
}

/**
 * Department -> province -> district over the ubigeo catalog (home delivery). The district is the
 * level that carries the 6-digit code, so choosing it is what fills the form. It starts from the
 * form's own ubigeo when there is one (the picker remounts when the delivery type is toggled),
 * otherwise from the customer's address, and stops guessing once the user picks by hand.
 */
export function useOlvaUbigeoCascade({
  guess,
  ubigeoCode,
  onUbigeoChange,
}: UseOlvaUbigeoCascadeParams) {
  const [department, setDepartment] = useState("");
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [isGuessing, setIsGuessing] = useState(true);

  const ubigeos = useOlvaUbigeoTree();
  const tree = ubigeos.data;

  const departments = tree ?? [];
  const provinces = departments.find((node) => node.name === department)?.provinces ?? [];
  const districts = provinces.find((node) => node.name === province)?.districts ?? [];

  // Come back to what the form already holds
  useEffect(() => {
    if (!tree || !ubigeoCode || department) return;

    for (const departmentNode of tree) {
      for (const provinceNode of departmentNode.provinces) {
        const districtNode = provinceNode.districts.find((node) => node.ubigeo.code === ubigeoCode);

        if (districtNode) {
          setIsGuessing(false);
          setDepartment(departmentNode.name);
          setProvince(provinceNode.name);
          setDistrict(districtNode.name);
          return;
        }
      }
    }
  }, [tree, ubigeoCode, department]);

  useEffect(() => {
    if (isGuessing && !ubigeoCode && !department && tree) {
      setDepartment(findOlvaDivisionName(guess.department, tree));
    }
  }, [isGuessing, ubigeoCode, department, tree, guess.department]);

  useEffect(() => {
    if (isGuessing && !ubigeoCode && department && !province && provinces.length > 0) {
      setProvince(findOlvaDivisionName(guess.province, provinces));
    }
  }, [isGuessing, ubigeoCode, department, province, provinces, guess.province]);

  useEffect(() => {
    if (isGuessing && !ubigeoCode && province && !district && districts.length > 0) {
      const name = findOlvaDivisionName(guess.district, districts);
      const match = districts.find((node) => node.name === name);

      if (match) {
        setDistrict(match.name);
        onUbigeoChange(match.ubigeo.code);
      }
    }
  }, [isGuessing, ubigeoCode, province, district, districts, guess.district, onUbigeoChange]);

  const chooseDepartment = (value: string) => {
    setIsGuessing(false);
    setDepartment(value);
    setProvince("");
    setDistrict("");
    onUbigeoChange("");
  };

  const chooseProvince = (value: string) => {
    setIsGuessing(false);
    setProvince(value);
    setDistrict("");
    onUbigeoChange("");
  };

  const chooseDistrict = (value: string) => {
    setIsGuessing(false);
    setDistrict(value);
    onUbigeoChange(districts.find((node) => node.name === value)?.ubigeo.code ?? "");
  };

  return {
    department,
    province,
    district,
    isLoading: ubigeos.isPending,
    isError: ubigeos.isError,
    departments,
    provinces,
    districts,
    chooseDepartment,
    chooseProvince,
    chooseDistrict,
  };
}
