import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getClientes, type ClientesFilters } from "../../../api/clientes.api";

export function useClientes(filters: ClientesFilters, page: number, pageSize: number) {
  return useQuery({
    queryKey: ["clientes", filters, page, pageSize],
    queryFn: () => getClientes(filters, page, pageSize),
    placeholderData: keepPreviousData,
  });
}
