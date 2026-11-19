-- Ejecutar con una identidad autorizada de instalación. Nunca con el runtime.
-- Revisar primero que se está conectado a SQLEXPRESS01 de desarrollo.
IF DB_ID('ContactCenterHub_Dev') IS NULL CREATE DATABASE ContactCenterHub_Dev;
GO
