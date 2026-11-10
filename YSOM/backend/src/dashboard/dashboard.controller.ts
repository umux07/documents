import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { SessionGuard } from "../auth/session.guard";

const plannedServices = [
  { id: "sim", name: "SIM services", status: "not_connected" },
  { id: "communications", name: "Messages and calls", status: "not_connected" },
  { id: "mobile-money", name: "Mobile money", status: "not_connected" },
];

@Controller("dashboard")
@UseGuards(SessionGuard)
export class DashboardController {
  @Get()
  getDashboard(@Req() request: Request) {
    return {
      user: request.authenticatedUser,
      services: plannedServices,
    };
  }
}
