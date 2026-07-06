import { Controller, Get, UseGuards, Post, Put, Body, Param, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { SupabaseService } from '../supabase/supabase.service';

@ApiTags('Autenticación y Roles')
@Controller('auth')
export class AuthController {
  constructor(private readonly supabaseService: SupabaseService) {}

  @Post('users')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Crear un nuevo usuario institucional' })
  @ApiResponse({ status: 201, description: 'Usuario creado con éxito' })
  @ApiResponse({ status: 400, description: 'Error al crear el usuario' })
  async createUser(@Body() body: any, @CurrentUser() adminUser: any) {
    const { email, first_name, last_name, role_id, career_id, avatar_url, ui_preferences } = body;

    if (!email || !first_name || !last_name || !role_id) {
      throw new BadRequestException(
        'Todos los campos (email, first_name, last_name, role_id) son requeridos'
      );
    }

    const supabase = this.supabaseService.getClient();

    // Crear el usuario en Supabase Auth con la Service Role Key para bypass de RLS y sesión
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: 'AsistApp2026!', // Contraseña por defecto
      email_confirm: true,
      user_metadata: {
        first_name,
        last_name,
        role_id,
        tenant_id: adminUser.tenant_id, // Heredar el tenant_id del admin creador
        career_id: career_id || null,
        avatar_url: avatar_url || null,
        ui_preferences: ui_preferences || {}
      },
    });

    if (authError || !authData.user) {
      throw new BadRequestException(`Error al registrar en Supabase Auth: ${authError?.message}`);
    }

    // Also insert directly into public.users for reliability (trigger may fail on null uuid casts)
    const { error: dbError } = await supabase
      .from('users')
      .upsert({
        id: authData.user.id,
        email,
        first_name,
        last_name,
        role_id,
        career_id: career_id || null,
        avatar_url: avatar_url || null,
        ui_preferences: ui_preferences || {},
        is_active: true,
        tenant_id: adminUser.tenant_id || null
      }, { onConflict: 'id' });

    if (dbError) {
      console.warn('Warning: Direct insert to users table failed (trigger may handle it):', dbError.message);
    }

    return {
      status: 'success',
      message: 'Usuario creado exitosamente',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        first_name,
        last_name,
        role_id,
      },
    };
  }

  @Put('users/:id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Actualizar un usuario institucional existente' })
  @ApiResponse({ status: 200, description: 'Usuario actualizado con éxito' })
  @ApiResponse({ status: 400, description: 'Error al actualizar el usuario' })
  async updateUser(@Param('id') id: string, @Body() body: any) {
    const { first_name, last_name, role_id, career_id, avatar_url, ui_preferences } = body;

    if (!first_name || !last_name || !role_id) {
      throw new BadRequestException(
        'Los campos (first_name, last_name, role_id) son requeridos'
      );
    }

    const supabase = this.supabaseService.getClient();

    // 1. Actualizar los metadatos en Supabase Auth con Service Role para bypass de políticas
    const { data: authData, error: authError } = await supabase.auth.admin.updateUserById(id, {
      user_metadata: {
        first_name,
        last_name,
        role_id,
        career_id: career_id || null,
        avatar_url: avatar_url || null,
        ui_preferences: ui_preferences || {}
      }
    });

    if (authError) {
      throw new BadRequestException(`Error al actualizar en Supabase Auth: ${authError.message}`);
    }

    // 2. Actualizar directamente la tabla public.users para sincronización síncrona robusta sin RLS lag
    const { error: dbError } = await supabase
      .from('users')
      .update({
        first_name,
        last_name,
        role_id,
        career_id: career_id || null,
        avatar_url: avatar_url || null,
        ui_preferences: ui_preferences || {}
      })
      .eq('id', id);

    if (dbError) {
      throw new BadRequestException(`Error al actualizar la base de datos de perfiles: ${dbError.message}`);
    }

    return {
      status: 'success',
      message: 'Usuario actualizado exitosamente',
      user: {
        id,
        first_name,
        last_name,
        role_id
      }
    };
  }

  @Get('public')
  @ApiOperation({ summary: 'Endpoint público de prueba' })
  @ApiResponse({ status: 200, description: 'Mensaje de éxito retornado' })
  getPublic() {
    return {
      status: 'success',
      message: 'Este es un endpoint público. No requiere token.',
    };
  }

  @Get('me')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Obtener perfil del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil retornado con éxito' })
  @ApiResponse({ status: 401, description: 'No autorizado / Token inválido' })
  getProfile(@CurrentUser() user: any) {
    return {
      status: 'success',
      message: 'Usuario autenticado correctamente con Supabase',
      user,
    };
  }

  @Get('admin-only')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Endpoint exclusivo para Administradores' })
  @ApiResponse({ status: 200, description: 'Acceso concedido' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'Prohibido / Rol insuficiente' })
  getAdminData(@CurrentUser() user: any) {
    return {
      status: 'success',
      message: 'Acceso concedido únicamente para administradores',
      adminId: user.id,
      email: user.email,
    };
  }

  @Get('docente-only')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('docente')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Endpoint exclusivo para Docentes' })
  @ApiResponse({ status: 200, description: 'Acceso concedido' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'Prohibido / Rol insuficiente' })
  getTeacherData(@CurrentUser() user: any) {
    return {
      status: 'success',
      message: 'Acceso concedido únicamente para docentes asignados',
      teacherId: user.id,
      email: user.email,
    };
  }
}
