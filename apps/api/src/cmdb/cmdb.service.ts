import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../core/prisma.service';

@Injectable()
export class CmdbService {
  constructor(private prisma: PrismaService) {}

  classes() { return this.prisma.ci_classes.findMany({ orderBy: { name: 'asc' } }); }

  async listCis(q: any) {
    const where: any = {};
    if (q.status) where.status = q.status;
    if (q.class) {
      const cls = await this.prisma.ci_classes.findUnique({ where: { name: q.class } });
      if (cls) where.class_id = cls.id;
    }
    const attrs: Record<string, string> = {};
    for (const [k, v] of Object.entries(q)) {
      if (k.startsWith('attr.')) attrs[k.slice(5)] = v as string;
    }
    const rows = await this.prisma.cis.findMany({
      where: Object.keys(attrs).length
        ? { ...where, AND: Object.entries(attrs).map(([k, v]) => ({ attributes: { path: [k], equals: v } })) }
        : where,
      include: { ci_classes: true }, orderBy: { created_at: 'desc' }, take: 200,
    });
    return rows;
  }

  async createCi(user: any, dto: { class: string; name: string; attributes?: any; environment?: string; status?: string }) {
    const cls = await this.prisma.ci_classes.findUnique({ where: { name: dto.class } });
    if (!cls) throw new NotFoundException(`unknown class ${dto.class}`);
    return this.prisma.cis.create({
      data: {
        class_id: cls.id, name: dto.name, attributes: dto.attributes ?? {},
        environment: dto.environment ?? 'prod', status: dto.status ?? 'active',
        owner_id: user.sub, discovered_by: 'manual',
      },
    });
  }

  async getCi(id: string) {
    const ci = await this.prisma.cis.findUnique({ where: { id }, include: { ci_classes: true } });
    if (!ci) throw new NotFoundException();
    const rels = await this.prisma.ci_relations.findMany({
      where: { OR: [{ source_id: id }, { target_id: id }] },
    });
    return { ...ci, relations: rels };
  }

  updateCi(id: string, dto: any) {
    const data: any = {};
    for (const k of ['name', 'status', 'environment', 'attributes']) if (dto[k] !== undefined) data[k] = dto[k];
    data.updated_at = new Date();
    return this.prisma.cis.update({ where: { id }, data });
  }

  createRelation(dto: { source_id: string; target_id: string; relation: string }) {
    return this.prisma.ci_relations.create({ data: dto });
  }
}
