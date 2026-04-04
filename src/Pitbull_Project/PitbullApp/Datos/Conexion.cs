using MySql.Data.MySqlClient;
using System;
using System.Windows;

namespace PitbullApp.Datos
{
    public class Conexion
    {
         //Configuracion de la cadena de conexion local (sin internet)

            //De ser necesario recordar cambiar el valor de "Pwd" a su contraseña en MySql

         private static string cadena="Server=localhost; Database=Pitbulldb; Uid=root; Pwd=1234;";

         public static MySqlConnection ObtenerConexion()
        {
            MySqlConnection conectar = new MySqlConnection (cadena);
            try
            {
                conectar.Open();
                return conectar;
            }
            catch (Exception ex)
            {
                //verificacion de que el servicio de MySql este funcionando y iniciado

             MessageBox.Show("Error al conectar con la base de datos:" + ex.Message);

                throw; // relanza el error, evir¿tando errores con valores null
            }
        }
    }
}