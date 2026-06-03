export type MetrcFacilityRow = {
  id: number;
  facility_id: number | null;
  license_number: string;
  facility_name: string | null;
  display_name: string | null;
  license_type: string | null;
  start_date: string | null;
  end_date: string | null;
  synced_at: string;
};

export type MetrcFacilitiesResponse = {
  facilities: MetrcFacilityRow[];
  count: number;
  sandbox: boolean;
  base_url_host: string;
  sync_stats?: Record<string, unknown> | null;
};

export type MetrcLocationRow = {
  id: number;
  metrc_id: number;
  license_number: string;
  name: string | null;
  location_type_id: number | null;
  location_type_name: string | null;
  is_active: boolean;
  synced_at: string;
};

export type MetrcStrainRow = {
  id: number;
  metrc_id: number;
  license_number: string;
  name: string | null;
  testing_status: string | null;
  thc_level: number | null;
  cbd_level: number | null;
  indica_percentage: number | null;
  sativa_percentage: number | null;
  is_active: boolean;
  synced_at: string;
};

export type MetrcItemRow = {
  id: number;
  metrc_id: number;
  license_number: string;
  name: string | null;
  product_category_name: string | null;
  product_category_type: string | null;
  quantity_type: string | null;
  unit_of_measure_name: string | null;
  default_lab_testing_state: string | null;
  is_active: boolean;
  synced_at: string;
};

export type MetrcMasterDataResponse<T> = {
  license_number: string | null;
  count: number;
  sandbox: boolean;
  base_url_host: string;
  sync_stats?: Record<string, unknown> | null;
} & T;

export type MetrcLocationsResponse = MetrcMasterDataResponse<{
  locations: MetrcLocationRow[];
}>;

export type MetrcStrainsResponse = MetrcMasterDataResponse<{
  strains: MetrcStrainRow[];
}>;

export type MetrcItemsResponse = MetrcMasterDataResponse<{
  items: MetrcItemRow[];
}>;

export type MetrcReferenceResponse = {
  data: unknown;
  sandbox: boolean;
  base_url_host: string;
};
