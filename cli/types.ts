import type { Entity } from "@em/shared";

/** GET /api/rooms 响应：服务端把一间房的实体聚合成功率与电量 */
export interface Room {
  id: string;
  name: string;
  online: boolean;
  power: number;
  energy: number;
  entities: Entity[];
}
