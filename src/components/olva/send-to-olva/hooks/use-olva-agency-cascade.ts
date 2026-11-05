import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useOlvaAgencyDepartments } from "@/features/olva/olva-agency/hooks/use-olva-agency-departments";
import { useOlvaAgencyDistricts } from "@/features/olva/olva-agency/hooks/use-olva-agency-districts";
import { useOlvaAgencyProvinces } from "@/features/olva/olva-agency/hooks/use-olva-agency-provinces";
import { olvaAgencyQueries } from "@/features/olva/olva-agency/queries/olva-agency.queries";
import { findOlvaDivisionName } from "../utils/find-olva-division-name";

export interface OlvaAddressGuess {
  department: readonly (string | null | undefined)[];
  province: readonly (string | null | undefined)[];
  district: readonly (string | null | undefined)[];
}

/**
 * Department -> province -> district -> agencies, each level loaded from the one above. It starts
 * on the customer's own address when Olva has agencies there, and stops guessing the moment the
 * user picks something by hand.
 */
export function useOlvaAgencyCascade(guess: OlvaAddressGuess) {
  const [department, setDepartment] = useState("");
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [isGuessing, setIsGuessing] = useState(true);

  const departments = useOlvaAgencyDepartments();
  const provinces = useOlvaAgencyProvinces(department || null);
  const districts = useOlvaAgencyDistricts(department || null, province || null);
  const agencies = useQuery({
    ...olvaAgencyQueries.list({
      department: department || undefined,
      province: province || undefined,
      district: district || undefined,
    }),
    // Without a province the list would be every agency in the country
    enabled: Boolean(department && province),
  });

  useEffect(() => {
    if (isGuessing && !department && departments.data) {
      setDepartment(findOlvaDivisionName(guess.department, departments.data));
    }
  }, [isGuessing, department, departments.data, guess.department]);

  useEffect(() => {
    if (isGuessing && department && !province && provinces.data) {
      setProvince(findOlvaDivisionName(guess.province, provinces.data));
    }
  }, [isGuessing, department, province, provinces.data, guess.province]);

  useEffect(() => {
    if (isGuessing && province && !district && districts.data) {
      setDistrict(findOlvaDivisionName(guess.district, districts.data));
    }
  }, [isGuessing, province, district, districts.data, guess.district]);

  const choose = (level: "department" | "province" | "district", value: string) => {
    setIsGuessing(false);

    if (level === "department") {
      setDepartment(value);
      setProvince("");
      setDistrict("");
    } else if (level === "province") {
      setProvince(value);
      setDistrict("");
    } else {
      setDistrict(value);
    }
  };

  return {
    department,
    province,
    district,
    departments,
    provinces,
    districts,
    agencies,
    chooseDepartment: (value: string) => choose("department", value),
    chooseProvince: (value: string) => choose("province", value),
    chooseDistrict: (value: string) => choose("district", value),
  };
}
