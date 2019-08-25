---
layout: post
title:  Comparing SemVer strings in Scala
date:   2019-08-25 18:55:25 +0200
author: Dinko Osrecki
tags:   semver scala json
---
We are given a JSON list of mobile devices, each of which has an ID, OS version and application version.

```scala
val devicesJson =
  """
    [
      {
        "id": "7CD561F4-0CFD",
        "osVersion": "12.3.1",
        "appVersion": "1.9.4"
      },
      {
        "id": "048DFEF1-65D9",
        "osVersion": "9.0",
        "appVersion": "2.0.1"
      },
      {
        "id": "46870AA5-88FE",
        "osVersion": "8.1",
        "appVersion": "1.8.5"
      },
      {
        "id": "5A4627A8-44D6"
      }
    ]
  """
```

We need to filter the list based on OS and application versions which are installed on a device. For this purpose, we
are given the criteria which each device has to satisfy. If a device does not have a property which is defined in the
criteria, it fails the test. We must support following operators: `=`, `!=`, `>`, `>=`, `<`, and `<=`.

```scala
val criteriaJson =
  """
    [
      {
        "parameter": "appVersion",
        "operator": ">=",
        "value": "1.0.0"
      },
      {
        "parameter": "appVersion",
        "operator": "<",
        "value": "2.0.0"
      },
      {
        "parameter": "osVersion",
        "operator": ">",
        "value": "10.0.0"
      }
    ]
  """
```

Ultimately we want to do the following:

```scala
val devices = Json.parse(devicesJson).as[Seq[Device]]
val criteria = Json.parse(criteriaJson).as[Seq[VersionCriterion]]

devices.filter(device => criteria.forall(_.matches(device)))
// List(
//   Device(7CD561F4-0CFD,Some(Version(12,3,1)),Some(Version(1,9,4)))
// )
```

#### JSON parsing
First, we need to parse each device and criterion from JSON. Each parser will implement the following interface:

```scala
trait Parser[T] {
    def parse(input: String): Option[T]
}
```

Criterion `parameter` field is an enumeration with two values: `appVersion` and `osVersion`. It is straightforward to
model it with `case class` and `object`s. To convert a `String` into `Parameter` we simply search for the string in
the set of available parameters.

```scala
import play.api.libs.json.{__, Reads}

sealed case class Parameter private (value: String)

object Parameter {
  object AppVersion extends Parameter("appVersion")
  object OsVersion extends Parameter("osVersion")

  val parameters: Set[Parameter] = Set(AppVersion, OsVersion)

  implicit val reads: Reads[Parameter] =
    __.read[String].map(ParameterParser.parse).filter(_.isDefined).map(_.get)
}

object ParameterParser extends Parser[Parameter] {
  override def parse(input: String): Option[Parameter] =
    Parameter.parameters.find(_.value == input)
}
```

If `ParameterParser` is not able to parse the input string, `Reads[Parameter]` returns `JsError` which will make
`Json.parse` throw a `JsResultException`.

````scala
import play.api.libs.json._

Json.parse("\"appVersion\"").as[Parameter] // Parameter(appVersion)
Json.parse("\"invalid\"").as[Parameter] // play.api.libs.json.JsResultException
````

Criterion `operator` field can be modeled in exactly the same way.

```scala
import play.api.libs.json.{__, Reads}

sealed case class Operator private (value: String)

object Operator {
  object EQ extends Operator("=")
  object NE extends Operator("!=")
  object GT extends Operator(">")
  object GE extends Operator(">=")
  object LT extends Operator("<")
  object LE extends Operator("<=")

  val operators: Set[Operator] = Set(EQ, NE, GT, GE, LT, LE)

  implicit val reads: Reads[Operator] =
    __.read[String].map(OperatorParser.parse).filter(_.isDefined).map(_.get)
}

object OperatorParser extends Parser[Operator] {
  override def parse(input: String): Option[Operator] =
    Operator.operators.find(_.value == input)
}
```

Last piece for which we need to define a parser is the `version` property. I will only focus on parsing simple SemVer
strings, where each component (`major.minor.patch`) can only be a number. If a component is omitted it is considered
to be zero.

```scala
import play.api.libs.json.{__, Reads}

case class Version(major: Int, minor: Int, patch: Int)

object Version {
  def apply(input: String): Option[Version] = VersionParser.parse(input)

  implicit val reads: Reads[Version] =
    __.read[String].map(Version.apply).filter(_.isDefined).map(_.get)
}

object VersionParser extends Parser[Version] {
  override def parse(input: String): Option[Version] = {
    val parts = input.split('.').padTo(3, "0").map(_.toIntOption).flatten

    parts match {
      case Array(x, y, z) => Some(Version(x, y, z))
      case _              => None
    }
  }
}
```

Device and criterion parsers now come for free.

```scala
import play.api.libs.json.{Json, Reads}

case class Device(id: String, osVersion: Option[Version], appVersion: Option[Version])
object Device {
  implicit val reads: Reads[Device] = Json.reads[Device]
}

case class VersionCriterion(parameter: Parameter, operator: Operator, value: Version)
object VersionCriterion {
  implicit val reads: Reads[VersionCriterion] = Json.reads[VersionCriterion]
}
```

Let's try it out.

```scala
Json.parse(
  """
    {
      "id": "7CD561F4-0CFD",
      "osVersion": "12.3.1",
      "appVersion": "1.9.4"
    }
  """).as[Device]
// Device(7CD561F4-0CFD,Some(Version(12,3,1)),Some(Version(1,9,4)))

Json.parse(
  """
    {
      "parameter": "appVersion",
      "operator": ">=",
      "value": "1.0.0"
    }
  """).as[VersionCriterion]
// VersionCriterion(Parameter(appVersion),Operator(>=),Version(1,0,0))
```

#### Comparing `Version`s
Currently, we can only perform equality and inequality comparisons on instances of `Version`.

```scala
Version("1.0.0") == Version("1.0.0") // true
Version("2.0.0") != Version("1.0.0") // true
Version("2.0.0") < Version("1.0.0")  // Cannot resolve symbol <
```

To support other operators we have to implement `Ordered` trait. Here, I use the `Ordering` instance of type
`(Int, Int, Int)` which is perfect for this use case, since tuples compare in a same way as SemVer components
(from the leftmost to the rightmost element).

```scala
case class Version(major: Int, minor: Int, patch: Int) extends Ordered[Version] {
  override def compare(that: Version): Int =
    implicitly[Ordering[(Int, Int, Int)]].compare(
      (major, minor, patch),
      (that.major, that.minor, that.patch)
    )
}
```

```scala
Version("2.0.0") < Version("1.0.0")  // false
Version("2.0.0") >= Version("1.0.0") // true
```

Now that everything is in place, let's extend `VersionCriterion` class to match against a specific `Version`. Thanks
to implementing the `Ordered` trait earlier, we come to an elegant solution.

```scala
case class VersionCriterion(parameter: Parameter, operator: Operator, value: Version) {
  import Operator._

  def matches(that: Version): Boolean = operator match {
    case EQ => that == value
    case NE => that != value
    case GT => that > value
    case GE => that >= value
    case LT => that < value
    case LE => that <= value
  }
}
```

```scala
val criterion = VersionCriterion(Parameter.AppVersion, Operator.EQ, Version(1, 0, 0))
val version = Version(1, 0, 0)

criterion.matches(version) // true
```

Finally, let's extend `VersionCriterion` class one more time to match against a specific device. Based on the value
of the `parameter` field, we compare against either `appVersion` or `osVersion` of the device.

```scala
case class VersionCriterion(parameter: Parameter, operator: Operator, value: Version) {
  import Parameter._
  import Operator._

  def matches(device: Device): Boolean = {
    val version = parameter match {
      case AppVersion => device.appVersion
      case OsVersion  => device.osVersion
    }

    version.exists(matches)
  }

  def matches(that: Version): Boolean = operator match {
    case EQ => that == value
    case NE => that != value
    case GT => that > value
    case GE => that >= value
    case LT => that < value
    case LE => that <= value
  }
}
```

We can now filter the devices list according to the given criteria.

```scala
val devices = Json.parse(devicesJson).as[Seq[Device]]
val criteria = Json.parse(criteriaJson).as[Seq[VersionCriterion]]

devices.filter(device => criteria.forall(_.matches(device)))
```
